import { Datex } from "unyt_core";
import { UIX } from "uix";

import { ResourceManger, Resource, resource_meta } from "uix/uix_all.ts";
import MonacoHandler from "../code_editor/monaco.ts";



export function escapeHtml(str:string) {
    if (typeof str != "string") return "";
    return str.replace(/&/g, "&amp;").replace(/ /g, "&nbsp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}


// for using all kinds of values (datex pointers, JSON objects, ...) as resources
// renders HTML in trees with syntax highlighting
class DatexValueResourceManager extends ResourceManger {
  
    override is_directory_can_change = true; // set to true if directory resources can become normal resources and the other way round

    // @override use as root value
    public root_value:Map<any,any>|{[key:string]:any}|any[] = {};

    constructor(channel:string, root_value?: any, pointer_listeners = false, root_resource_meta?:resource_meta) {
        super(channel);
        // root value specified?
        if (root_value) this.root_value = root_value;
        // set root resource type: datex_root_value  
        // set root value as reference for the root resource
        this.root_resource.setMeta({type: "datex_root_value", reference:this.root_value, ...(root_resource_meta??{})})

        // listen for pointer updates
        if (pointer_listeners) this.initPointerListeners()
    }

    private initPointerListeners(){


        Datex.Pointer.onPointerRemoved(async (p:Datex.Pointer)=>{
            const resources = await this.getResourcesWithIdentifier(p.idString())
            for (const r of resources) {
                r.delete();
                this.onResourceRemoved(r);
            }
        })

        Datex.Pointer.onPointerPropertyChanged(async (p:Datex.Pointer, key:any, value:any)=>{
            if (typeof key != "string") key = key.toString();
            const entries = this.getResourcesWithIdentifier(p.idString())
            for (const resource of entries) {
                await this.onResourceUpdated(await resource.getChild(key)); // update only the resource for the property
            }
        })
        Datex.Pointer.onPointerPropertyAdded((p:Datex.Pointer, key:any, value:any)=>{
            const entries = this.getResourcesWithIdentifier(p.idString())
            for (const resource of entries) {
                this.onResourceUpdated(resource); // update whole parent
            }
        })
        Datex.Pointer.onPointerPropertyDeleted((p:Datex.Pointer, key:any)=>{
            const entries = this.getResourcesWithIdentifier(p.idString())
            for (const resource of entries) {
                this.onResourceUpdated(resource); // update whole parent
            }
        })

        Datex.Pointer.onPointerValueChanged((p:Datex.Pointer)=>{
            const entries = this.getResourcesWithIdentifier(p.idString())
            for (const resource of entries) {
                this.onResourceUpdated(resource); // update whole parent
            }
        })
    }

    // use to generate a resource for a value
    private value_resource_map = new Map<any, Resource>();
    public async getResourceForValue(value: any): Promise<Resource> {
        // is pointer?
        value = Datex.Pointer.pointerifyValue(value);
        if (value instanceof Datex.Pointer) return Resource.get("dxptr:///$" + value.id + "/");
        // value already a resource
        if (this.value_resource_map.has(value)) return this.value_resource_map.get(value)
        // generate unique id
        const id = UIX.Utils.getUniqueElementId('');
        dx_value_manager.root_value[id] = value;
        // get resource
        const res = await this.root_resource.getChild(id+'/');
        res.setMeta({key:id});
        // add to value_resource_map
        this.value_resource_map.set(value, res)
        return res;
    }


    getMetaData(resource: Resource): Promise<object> {
        // top level pointer
        if (resource.meta.type == 'datex_top_level_pointer') return this.getValueMetaData(null, null, resource.meta.reference)
        // root value
        else if (resource.meta.type == 'datex_root_value' || resource.meta.type == 'datex_pointer_root') return null;
        // other value
        else if (resource.parent) {
            // break parent down to serialized value
            return this.getValueMetaData(resource.parent, resource.meta.key)
        } 
    }

    isDirectory(resource: Resource): Promise<boolean> {
        // check reference value to find out if the value has children or not
        let unserialized_value = resource.meta.reference;
        if (!('reference' in resource.meta)) { // try to get value from parent
            const parent_resource = resource.parent;
            if (!parent_resource) return true;
            const ref = parent_resource.meta.reference;
            if (!ref) return true;
            const parent = ref instanceof Datex.Value ? ref.val : ref; // deproxify pointer
            if (!parent) {
                //console.warn("no parent:", parent_resource);
                return false;
            }
            const serialized_parent = Datex.Runtime.serializeValue(parent);
            const key = resource.meta.key;
            unserialized_value = parent instanceof Map ? parent.get(key) : serialized_parent[key]
        }
        // deproxify pointer
        if (unserialized_value instanceof Datex.Value) unserialized_value = unserialized_value.val;
        return this.isValueDirectory(unserialized_value)
    }

    isValueDirectory(value:any) {
        return !Datex.Type.ofValue(value).is_primitive && !Datex.Type.ofValue(value).is_js_pseudo_primitive;
    }

    addResource(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }

    addResourceDirectory(resource: Resource): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getResourceValue(resource: Resource): Promise<any>|any {
        
    }
    setResourceValue(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    async getChildren(resource: Resource, update_meta=true): Promise<(string | [string, any])[]> {
        // handle root resource
        if (resource.meta.type == "datex_root_value") {
            const children = [];
            for (const [key, val] of (this.root_value instanceof Map ? this.root_value : Object.entries(this.root_value))) {
                children.push([this.getValuePath(this.root_resource, key), update_meta?await this.getValueMetaData(this.root_resource, key):null]);
            }
            return children;
        }
        // handle pointer root
        else if (resource.meta.type == "datex_pointer_root") {
            const children = [];
            for (const [key, p] of (this.root_value instanceof Map ? this.root_value : Object.entries(this.root_value))) {
                children.push([this.getPointerPath(p), update_meta?await this.getValueMetaData(null, null, p):null]);
            }
            return children;
        }
        // handle all other values
        else if ((resource.meta.type == "datex_value" || resource.meta.type == "datex_top_level_pointer") && resource.meta.reference) {
            // break down to serialized value
            const ptr = resource.meta.reference;
            const unserialized_value = ptr instanceof Datex.Pointer ? ptr.val : ptr;

            const value = Datex.Runtime.serializeValue(unserialized_value); 


            const children = [];
           
            // Function / DatexCodeBlock
            if (unserialized_value instanceof Datex.Scope || unserialized_value instanceof Datex.Function) {
                const k = "_body";
                children.push([this.getValuePath(resource, k), update_meta?await this.getValueMetaData(resource, k):null]);
            }
            // Map object
            else if (value instanceof Array && unserialized_value instanceof Map) {
                for (const [k,] of value) children.push([this.getValuePath(resource, k), update_meta?await this.getValueMetaData(resource, k):null])
            }
            // only get ptr readable properties
            else if (ptr instanceof Datex.Pointer && ptr.visible_children) {
                for (const k of ptr.visible_children) {
                    children.push([this.getValuePath(resource, k), update_meta?await this.getValueMetaData(resource, k):null])
                }
            }
            // others (array, object)
            else if (typeof value == "object" && value != null) {
                for (const k of Object.keys(value)) {
                    children.push([this.getValuePath(resource, k), update_meta?await this.getValueMetaData(resource, k):null])
                }
            }
            // else value has no children in serialized form 

            return children;
        }
        else return []

    }
    renameResource(resource: Resource, new_name: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteResource(resource: Resource): Promise<void> {
        return null;
        //throw new Error("Method not implemented.");
    }
    moveResource(resource: Resource, new_path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }


    // helper methods

    async getPointerMetaData(p: Datex.Pointer):Promise<any> {
        const meta:any = {
            reference: p,
            type: "datex_top_level_pointer",
            identifier: p.idString()
        }

        if (!p.value_initialized) { // pointer has no value, was probably garbage collected
            meta.html = "### Pointer does not exist ###";
            return meta;
        }

        const type = Datex.Type.ofValue(p.val);
        const colored = await this.getFormattedType(p.val, false);
    
    
        // Datex block or function
        if (p.val instanceof Datex.Function) {
 
            const value = p.val;
            
            meta.braces = ["(", ")"];
            meta.html = `<span>${colored}${await this.getFormattedValue(`${value.params.size ? Datex.Runtime.valueToDatexString(value.params) : '()'} `)}</span>`
            meta.filter_strings = [colored, ...(Object.keys(value.params)?.map(v=>v.toString())||[]), p.id]
            if (value instanceof Datex.Scope) meta.filter_strings.push(value.decompiled_formatted)
        }

        /*// Filter TODO endless loop (<Set> [0] generated if activated)
        else if (p.val instanceof DatexFilter) {
            meta.html = `${colored} ${await this.getFormattedValue(DatexRuntime.valueToDatexString(p.val, true, false))}`
        }*/

        // display compact
        else if (type?.has_compact_rep) {
            let datex_string = Datex.Runtime.valueToDatexString(p.val, false, true);
            meta.html = colored + await this.getFormattedValue(datex_string)
            meta.filter_strings = [colored, datex_string, p.id]
        }

        // display with pseudo cast and/or JSON 
        else {
            meta.html = colored;
            meta.braces = p.val instanceof Datex.Tuple ? ["(", ")"] : (p.val instanceof Set || p.val instanceof Map || p.val instanceof Array  ? ["[", "]"] : ["{", "}"]);
            meta.filter_strings = [colored, p.id]
        }

        return meta;
    }


    // get resource paths
    getPointerPath(p:Datex.Pointer):string {
        return "/$" + p.id + (this.isValueDirectory(p) ? '/' : '')
    }

    getValuePath(parent_resource: Resource, key:any):string {
        const ref = parent_resource.meta.reference;
        const parent = ref instanceof Datex.Pointer ? ref?.val : ref;
        if (!parent) {
            // console.warn("no parent:", parent_resource);
            return;
        }
        const serialized_parent = Datex.Runtime.serializeValue(parent);
        const unserialized_value = parent instanceof Map ? parent.get(key) : serialized_parent?.[key]

        return parent_resource.default_path + "/" + key + (this.isValueDirectory(unserialized_value) ? '/' : '');
    }

    protected async getValueMetaData(parent_resource: Resource, key:any, pointer?:Datex.Pointer) {
        
        let meta:any;
        let parent_array_like:boolean;
        let parent:any;
        let unserialized_value:any;
        let value:any;
        let identfier:string;
        let declare_symbol:string;
        let escape_key: boolean;

        let is_top_level_pointer: boolean;
        let labels:string = "";

        // top level pointer
        if (pointer) {
            is_top_level_pointer = true;
            meta = {
                reference: pointer,
                type: "datex_top_level_pointer",
                identifier: pointer.idString(),
                filter_strings: [pointer.id, await this.getFormattedType(pointer.val, false)]
            };
    
            if (pointer.val === Datex.VOID) { // pointer has no value, was probably garbage collected
                meta.html = "### Pointer does not exist ###";
                return meta;
            }

            if (is_top_level_pointer && pointer.labels?.size) {
                for (const label of pointer.labels) labels +=  Datex.Runtime.formatVariableName(label, "$") + " = "
                labels = await this.getFormattedValue(labels);
            }

            unserialized_value = pointer.val;
            value = Datex.Runtime.serializeValue(unserialized_value) // serialize;
        }
        // normal value
        else {

            is_top_level_pointer = false;
            meta = {type: "datex_value", key: key, filter_strings:[]}

            // handle parent
            const ref = parent_resource.meta.reference
            if (ref == undefined) return null;
            parent = ref instanceof Datex.Value ? ref?.val : ref;
            if (!parent) {
                // console.warn("no parent:", parent_resource);
                return;
            }

            const serialized_parent = Datex.Runtime.serializeValue(parent);
            parent_array_like = (parent == dx_value_manager.root_value) || (serialized_parent instanceof Array && !(parent instanceof Map));
            
            unserialized_value = parent instanceof Map ? parent.get(key) : serialized_parent?.[key]
            value = Datex.Runtime.serializeValue(unserialized_value) // serialize;
        
            pointer = Datex.Pointer.pointerifyValue(unserialized_value);
            identfier = pointer instanceof Datex.Pointer? pointer.idString() : null;

            declare_symbol = parent instanceof Datex.StaticScope ? " = " : (parent instanceof Map ? " ⭢ " : ":");
            escape_key = (parent instanceof Map && ! (parent instanceof Datex.StaticScope)) || ! (typeof key == "string" && key.match(Datex.Runtime.TEXT_KEY));

            meta.reference = Datex.Pointer.pointerifyValue(unserialized_value)
            if (identfier) meta.identifier = identfier;
        }

        if (pointer instanceof Datex.PointerProperty) {
            value = pointer.val;
        }
        
        // show datex block / function body
        if (parent instanceof Datex.Function) {
            const body = parent.bodyToString(true, false, '');
            if (body == '(### native code ###)') meta.html = this.native_indicator
            else meta.html = '<div style="display:block">' + await this.getFormattedValue(body) + '</div>';
            if (parent instanceof Datex.Scope) meta.filter_strings.push(parent.decompiled_formatted)
            else if (parent.body) meta.filter_strings.push(parent.body.decompiled_formatted)

        }


        // Show function
        else if (unserialized_value instanceof Datex.Function) {
            meta.braces = ["(", ")"];
            
            let dx_key = Datex.Runtime.valueToDatexString(key);

            meta.html = labels;

            if (escape_key) meta.html += (await this.getFormattedValue(Datex.Runtime.valueToDatexString(key))).replace(/\<br\/\>$/g, "") + declare_symbol+"    " + await this.getFormattedType(unserialized_value);
            else if (parent_array_like) meta.html += await this.getFormattedType(unserialized_value, !is_top_level_pointer);
            else meta.html += (!is_top_level_pointer ? escapeHtml(key) + declare_symbol+"  " : "") +  await this.getFormattedType(unserialized_value, !is_top_level_pointer);

            meta.html += (await this.getFormattedValue(`${unserialized_value.params.size ? Datex.Runtime.valueToDatexString(unserialized_value.params) : '()'} `))
            meta.filter_strings.push(...(Object.keys(unserialized_value.params)?.map(v=>v.toString())||[]));
            if (!is_top_level_pointer) meta.filter_strings.push(dx_key)
        }

        else if (unserialized_value instanceof Datex.StaticScope) {
            meta.braces = ["(", ")"];
            meta.html = '<span>'+labels+escapeHtml(unserialized_value.name + " = ") + "</span>";
        }
        
        // else if (pointer instanceof Datex.PointerProperty) {
        //     console.log("orim");
        //     let datex_formatted = Datex.Runtime.valueToDatexString(unserialized_value, false, true).replace(/\n/g, "\\n")
        //     let formatted_value:string = (is_top_level_pointer ?"":this.getPointerIndicator(unserialized_value)) + ((typeof value == "string" || value instanceof ArrayBuffer) ? await this.getFormattedMultilineValue(datex_formatted) : await this.getFormattedValue(datex_formatted));
        //     meta.html = formatted_value
        //     meta.filter_strings.push(datex_formatted)
        // }

        // recursive render children
        else if (!(!this.isValueDirectory(value) || Datex.Type.ofValue(unserialized_value).has_compact_rep)) {
            meta.braces = value instanceof Datex.Tuple ? ["(", ")"] : ((value instanceof Set || value instanceof Array) ? ["[", "]"] : ["{", "}"]);
            if (parent_array_like) {
                meta.html = labels + await this.getFormattedType(unserialized_value, !is_top_level_pointer);
                //meta.filter_strings = [DatexRuntime.valueToDatexString(unserialized_value, false, false)]
            }
            else if (escape_key) { // formatted key
                let dx_key = Datex.Runtime.valueToDatexString(key);
                meta.html = '<span>' + labels +  (!is_top_level_pointer ? (await this.getFormattedValue(dx_key)).replace(/\<br\/\>$/g, "")
                    + declare_symbol+"    ":"") +  await this.getFormattedType(unserialized_value, !is_top_level_pointer) + '</span>'
                if (!is_top_level_pointer) meta.filter_strings.push(dx_key)

            }
            else {
                meta.html = '<span>' + labels +  (!is_top_level_pointer ? escapeHtml(key) + declare_symbol+"    ":"") +  await this.getFormattedType(unserialized_value, !is_top_level_pointer) + '</span>';
                if (!is_top_level_pointer) meta.filter_strings.push(key)
            }
        }

        // only render primitive values
        else {        
            delete meta.braces;

            let datex_formatted = Datex.Runtime.valueToDatexString(unserialized_value, false, true).replace(/\n/g, "\\n")
            let formatted_value:string;

            if (unserialized_value instanceof Datex.Markdown) {
                const md = await unserialized_value.getHTML();
                md.style.overflow = "scroll";
                formatted_value = '<div style="height:fit-content;width:100%">' + md.outerHTML + '</div>'
            }
            else formatted_value = (is_top_level_pointer ?"":this.getPointerIndicator(unserialized_value)) + ((typeof value == "string" || value instanceof ArrayBuffer) ? await this.getFormattedMultilineValue(datex_formatted) : await this.getFormattedValue(datex_formatted));
            
            if (parent_array_like) {
                meta.html = formatted_value
                meta.filter_strings.push(datex_formatted)
            }
            else if (escape_key) { // formatted key
                let dx_key = Datex.Runtime.valueToDatexString(key).replace(/\n/g, "\\n");
                let formatted_key = (await this.getFormattedValue(dx_key)).replace(/\<br\/\>$/g, "");
                meta.html = (!is_top_level_pointer ? "<span style='display:inline-flex;width: 100%;'><span style='margin-right:8px'>"+formatted_key+declare_symbol:"<span style='width: 100%;'><span>")+"</span>"  
                        + formatted_value
                    + '</span>'
                    meta.filter_strings.push(datex_formatted)
                    if (!is_top_level_pointer) meta.filter_strings.push(dx_key)
            }
            else  { // no colored key
                meta.html = (!is_top_level_pointer ? "<span style='display:inline-flex;width: 100%;'><span style='margin-right:8px'>"+escapeHtml(key)+declare_symbol:"<span style='width: 100%;'><span>")+"</span>"  
                        + formatted_value
                    + '</span>'
                    meta.filter_strings.push(datex_formatted)
                    if (!is_top_level_pointer) meta.filter_strings.push(key)
            }
        }

        return meta;
    }


    async getFormattedType(value:any, show_pointer_indicator=true):Promise<string> {
        let type = Datex.Type.ofValue(value)

        let pointer_indicator = ""

        if (show_pointer_indicator) pointer_indicator = this.getPointerIndicator(value);

        // add type text?
        let type_text= ""

        if (Datex.Type.std.Function.matchesType(type)) type_text = "function "
        //else if (type==DatexType.std.Filter) type_text = type.toString();
        else if (type != Datex.Type.std.text_markdown && type != Datex.Type.std.time && !type?.is_primitive && type?.is_complex && !type?.has_compact_rep) type_text = type.toString() + " ";

        return (pointer_indicator + (await MonacoHandler.colorize(type_text, "datex")).replace(/\<br\/\>/g, ""))
    }

    getPointerIndicator(value:any):string {
        let _pointer = Datex.Pointer.pointerifyValue(value);
        if (_pointer instanceof Datex.Value) return this.pointer_indicator;
        else return "";
    }


    private pointer_indicator = `<div style='width: -webkit-fill-available;height:fit-content;display:inline-flex;background-color:#4166ee;justify-content:center;color: #ddd;width: 14px;min-width: 14px;font-weight:bold;margin-right:5px;border-radius:5px'>$</div>`
    private native_indicator = `<div style='height:fit-content;display:inline-flex;padding-left:4px;padding-right:4px;background-color:#111;color: #ddd;border-radius:5px'>native code</div>`

    private spliceString(string, index, insert) {
        var ind = index < 0 ? string.length + index  :  index;
        return  string.substring(0, ind) + insert + string.substr(ind);
    }

    // returns colored and formatted value as HTML (multi line or single line)
    private async getFormattedValue(datex_value:string, force_single_line=true){
        let formatted = (await MonacoHandler.colorize(datex_value, "datex")).replace(/\<br\/\>$/,'')
        return force_single_line ? this.spliceString(formatted, 5, ' style="white-space: nowrap;"') : formatted;
    }
    private async getFormattedMultilineValue(datex_value:string){
        return'<span class="multiline-span">' + (await this.getFormattedValue(datex_value, false)).replace(/\<br\/\>$/,'') + '</span>'
    }

    // bubble up filter string updates
    async updateFilterStringForEntry(resource:Resource){
        if (await resource.val instanceof Datex.Value) {
            resource.meta.filter_strings = [Datex.Runtime.valueToDatexString(resource.meta.reference?.val, false, true)];
        }
    }
}

class DatexPointerResourceManager extends DatexValueResourceManager {
    constructor() {
        super("dxptr://", Datex.Pointer.pointers, true, {type: "datex_pointer_root"});

        Datex.Pointer.onPointerAdded(async (p:Datex.Pointer)=>{
            this.onNewResource(this.getPointerPath(p), await this.getValueMetaData(null,null,p))
        })
    }
}


// dx_pointer_manager and dx_scope_manager get pointer updates, currently disabled for dx_value_manager
export const dx_pointer_manager = new DatexPointerResourceManager() // manager for all current pointers
export const dx_value_manager = new DatexValueResourceManager("dxval://") // manager for general values
export const dx_scope_manager = new DatexValueResourceManager("dxscopes://", Datex.StaticScope.scopes, true) // manager for static scopes
export const dx_type_manager = new DatexValueResourceManager("dxtypes://", Datex.Type.type_templates, true) // manager for type definitions

globalThis.dx_pointer_manager = dx_pointer_manager;
globalThis.dx_scope_manager = dx_scope_manager;
globalThis.dx_value_manager = dx_value_manager;