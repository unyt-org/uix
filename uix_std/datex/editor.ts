// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL, HTML } from "uix";
import MonacoHandler, { MonacoTab } from "../code_editor/monaco.ts";
import { LogBuffer } from "../console/main.ts";
import { escapeHtml } from "./resource_manager.ts";

export namespace DatexEditor {

	export interface Options extends UIX.Components.Base.Options {
		local_interface?: boolean // use local interface
		expand_header?: boolean // expand header per default
        advanced_view?: boolean // display advanced DATEX settings
		content?: string
	}
}

globalThis.DX_INSERT = []; // for default ? values

const example_script = `
use print from #std;
print 'Executed on (#endpoint), initiated by (#sender)';

# example object:
{
    "json key": "json value",
    values: ['1', 2, 3.0, 0xff, -infinity, nan, true, null, void],
    advanced: [
        <Set> [1,2,3,4],
        69kg,
        https://unyt.org,
        @example,
        'template string with evaluated expression: (5 * 10m)',
        (true or false) and (1+1 == 2)
    ]
}`

// Datex Editor
@UIX.Group("Datex")
@UIX.Component<DatexEditor.Options>({
    vertical_align: UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align: UIX.Types.HORIZONTAL_ALIGN.LEFT,
    expand_header: true,
    fill_content: true,
    advanced_view: false,
    content: Datex.Runtime.ENV.LANG == 'de'?
         "############################################\nDrücke [F2], um das DATEX Script auszuführen\nMehr Infos zu DATEX: docs.unyt.org/datex\n############################################\n\n"+example_script:
         "############################################\nPress [F2] to run the DATEX Script\nMore info about DATEX: docs.unyt.org/datex\n############################################\n\n"+example_script
    })
@UIX.NoResources
export class DatexEditor extends UIX.Components.Base<DatexEditor.Options> {

    declare private monaco:MonacoTab
    public log_buffer = new LogBuffer();

    protected override createContextMenu() {
        return {
            run: {
                text: S('run'),
                shortcut: "f2",
                handler: ()=> {
                    let req = this.runDatex()
                    this.options.content = req;
                }
            },
            v4: {
                text: S('v2'),
                shortcut: "f4",
                handler: ()=> {
                    let req = this.runDatex(true)
                    this.options.content = req;
                }
            },
            save: {
                text: S('download'),
                shortcut: "save",
                handler: ()=> {
                    let req = this.downloadDXB();
                    this.options.content = req;
                }
            }
        }
    }

    protected override createMenuBarEntries() {
        return {
            [SVAL`menu_file`]: {
                menu_entry_export_dxb: {
                    text: S`menu_entry_export_dxb`
                },
                menu_entry_export_dx: {
                    text: S`menu_entry_export_dx`
                },
                menu_entry_import_dxb: {
                    text: S`menu_entry_import_dxb`
                },
                menu_entry_import_dx: {
                    text: S`menu_entry_import_dx`
                },
                menu_entry_import_json: {
                    text: S`menu_entry_import_json`
                }
            }
        } 
    } 

    public override async onCreate() {

        await this.createHeader();

        if (this.options.local_interface) {
            await Datex.InterfaceManager.enableLocalInterface();
            await this.setDatexOutput(Datex.InterfaceManager.local_interface);
        }
    }

    private async createHeader(){

        const settings = props(this.settings);

        const header_els:{element:HTMLElement}[] = [
            {element: new UIX.Elements.Button({onClick:()=>this.runDatex(), content:await text`<span>${I`fa-play`} ${S('run')}</span>`, color:'var(--light_blue)', text_color:'#151515'}).css({marginRight:'10px'})},
            {element: new UIX.Elements.Button({onClick:()=>this.downloadDXB(), content:await text`<span>${I`fa-download`} ${S('download_short')}</span>`, color:'var(--text)', text_color:'#151515'})},
            {element: new UIX.Elements.Button({onClick:()=>this.downloadDXB(), content:await text`<span>${I`fa-upload`} ${S('upload_short')}</span>`, color:'var(--text)', text_color:'#151515'})},

        ]

        if (this.options.advanced_view) {
            header_els.push(
                {element: new UIX.Elements.Button({onClick:()=>this.runDatex(true), content:await text`<span>${I`fa-play`} ${S('v2')}</span>`, color:'var(--green)', text_color:'#151515'})},

                {element: new UIX.Elements.DropdownMenu(Datex.ProtocolDataTypesMap, {title:"Type", selected_index:settings.type})},
                {element: new UIX.Elements.Checkbox({label:'Sign', checked: settings.sign})},
                {element: new UIX.Elements.Checkbox({label:'Enrypt', checked: settings.encrypt})},
                {element: new UIX.Elements.Checkbox({label:'EOS', checked: settings.end_of_scope})},
                {element: new UIX.Elements.Checkbox({label:'IR', checked: settings.intermediate_result})},
                {element: new UIX.Elements.Checkbox({label:'Fixed SID', checked: this.settings.sid!=undefined, onChange:checked => (this.settings.sid = checked ? Math.round(Math.random()*20000) : undefined)})},
            )
        }
        else {
            header_els.unshift({element: HTML `<h2 style="margin-right:20px;color:var(--text_highlight)">DATEX <span style="color:var(--text)">Playground</span></h2>`})
        }

        this.header = new UIX.Elements.Header(header_els, {gaps:5, margin_bottom:true, seperator:true});

        this.header.style.padding = "10px";
    }

    private endpoint?: Datex.Endpoint


    _first = false;

    runDatex(v2=false):string{
        const req = this.monaco.getContent();
        this.sendDatexRequest(req,v2);
        return req;
    }

    setContent(content:Datex.CompatValue<string>) {
        Datex.Value.observeAndInit(content, content => {
            this.monaco.setContent(content)
        })
    }

    downloadDXB(){
        Datex.Compiler.compileAndExport(this.monaco.getContent())
    }

    @property settings = {
        encrypt: false,
        sign: true,
        type: Datex.ProtocolDataType.REQUEST,
        end_of_scope: true,
        intermediate_result: false,
        sid: Math.round(Math.random()*20000)
    }

    async sendDatexRequest(request:string, v2=false) {
        this._first = true;

        try {
            // todo send to right receiver
            const result = await Datex.Runtime.datexOut([
                request, 
                globalThis.DX_INSERT,
                {
                    sign:this.settings.sign, 
                    encrypt:this.settings.encrypt,
                    to:this.endpoint, 
                    type:this.settings.type, 
                    end_of_scope: this.settings.end_of_scope,
                    sid: this.settings.sid,
                    return_index: this.settings.intermediate_result ? Datex.Compiler.getNextReturnIndexForSID(this.settings.sid) : 0,
                    __v2:v2
                }
            ], this.endpoint, this.settings.sid);
            
            // output global result
            if (result!==Datex.VOID) this.log_buffer.log({data:[await this.format_output(result)], meta: {prepend:"result =", format:"ansi"}});
        }
        catch (error) {
            // output error
            if (error instanceof Error) {
                let error_array = error.stack?.split("\n");
                let error_string = "";
                error_string += `<span style="color:#e32948">${escapeHtml(error_array[0]??'')}</span>`
                for (let i=1;i<error_array.length;i++) {
                    error_string += `<br><span style='white-space:break-spaces;color:#d26476'>${escapeHtml(error_array[i]??'')}</span>`
                }
                error = UIX.Utils.createHTMLElement(`<div>${error_string}</div>`);
            }
            else error = await Datex.Runtime.castValue(Datex.Type.std.text, error);
            
            this.log_buffer.log({data:[error], meta: {prepend:"error  !", color:"#e32948", format:false}});
        }
    }



    private code_el:HTMLDivElement;

    private noConnection(){
        let empty = UIX.Utils.createHTMLElement(`<div style="user-select:none;width:100%;height:100%;display:flex;align-items:center;flex-direction:column;justify-content:center;color:var(--border_color);font-size:30px">${I`fas-redo-alt`}<span style='font-size:20px;text-align: center;font-family: "Roboto";margin-top: 10px;'>${S('no_interface')}</span></div>`)

        empty.addEventListener("click", ()=>{
            this.sendMessageUp("RETRY_INTERFACE")
        })

        this.content.append(empty);
    }

    override onInit(){
        this.addStyleSheet(MonacoHandler.stylesheet);
        // default view
        this.noConnection();
    }

    private initialized = false;

    private initConnection() {
        if (this.initialized) return;
        this.initialized = true;

        this.content.innerHTML = "";

        DatexEditor.datexAutoComplete() // initialize datex autocomplete        

        this.code_el = document.createElement("div");
        this.code_el.style.width = "100%";
        this.code_el.style.height = "100%";

        this.content.append(this.code_el);
    }

    private async format_output (param:any) {
        // format for output
        if (param instanceof HTMLImageElement) {
            param = param.cloneNode(true); // copy reference
            param.style.userSelect = "none";
            param.draggable = false;
            param.style.width = "350px";
            return param
        }
        else if (param instanceof Blob && param.type.startsWith("image/")) {
            const url = URL.createObjectURL(param);
            param = new Image();
            param.style.userSelect = "none";
            param.draggable = false;
            param.style.width = "350px";
            param.src = url;
            return param
        }
        else if (param instanceof Datex.Markdown) {
                return (await param.getHTML());
        }
        else {
            return Datex.Runtime.valueToDatexStringExperimental(param, true, true);
            //return Datex.Runtime.valueToDatexString(param, false, false, false, ConsoleView.HOVER_ANCHORS)
        }
    }

    async setDatexOutput(interf:Datex.ComInterface, endpoint?:Datex.Endpoint) {
        this.endpoint = endpoint ?? interf.endpoint;
        await this.initConnection();

        if (!this.monaco) {
            this.monaco = await MonacoHandler.createTab(this.code_el, null, true);
            this.monaco.loadText(this.options.content, "datex");

            // save when DATEX Script code changed
            this.monaco.addChangeListener(()=>{
                this.options.content = this.monaco.getContent();
            })
        }
       
        // set input for this interface aswell
        this.addDatexInput(this.endpoint)
    }

  

    addDatexInput(endpoint: Datex.Endpoint){
        // std:out, std:outf and std:err
        Datex.IOHandler.setStdOutF(async (data)=>{
                let new_data = [];
                for (let d of data) {
                        new_data.push(await this.format_output(d), UIX.Utils.createHTMLElement('<span style="width:0.6em"></span>'));
                }
                await this.log_buffer.log({data:new_data, meta:{format:"ansi", prepend:"printf >"}});
        }, endpoint)
        
        Datex.IOHandler.setStdOut(async (data)=>{ 
            let new_data = [];
            for (let d of data) {
                    new_data.push(await Datex.Runtime.castValue(Datex.Type.std.text, d));
                    new_data.push(" ");
            }  
            new_data.pop()   
            await this.log_buffer.log({data:new_data, meta:{prepend:"print  >", format:false}});
        }, endpoint)

        Datex.IOHandler.setStdIn(async msg=>{
            if (msg[0]!==undefined) msg[0] = await Datex.Runtime.castValue(Datex.Type.std.text, msg[0]);
            if (msg[1]!==undefined) msg[1] = await Datex.Runtime.castValue(Datex.Type.std.text, msg[1]);
            return this.log_buffer.readInput({data:msg, meta:{prepend:"read   >", format:false}});
        }, endpoint)
        
    }

    addDatexRawInput(endpoint: Datex.Endpoint) {
        Datex.IOHandler.onDatexReceived((header, dxb)=>{
            this.log_buffer.log({data:[Datex.Decompiler.decompile(dxb)], meta:{prepend:header.sender+" >", format:'datex'}});
        }, endpoint);
    }

    static autocomplete_initialized = false;

    // add simple autcomplete features for datex
    private static datexAutoComplete(){
        if (this.autocomplete_initialized) return;
        this.autocomplete_initialized = true;

        // all std types
        const auto_types_list:any[] = []
        for (const type of Datex.Type.types.values()) {
            auto_types_list.push({
                label: type.toString(),
                kind: MonacoHandler.monaco.languages.CompletionItemKind.TypeParameter,
                insertText: type.toString()
            })
        }

        // default variables
        const variables_list:any[] = [
            {
                label: "sender",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  `#sender`,
            },
            {
                label: "current",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  `#current`,
            },
            {
                label: "root",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#root',
            },
            {
                label: "result",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#result',
            },
            {
                label: "sub_result",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#sub_result',
            },
            {
                label: "this",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#this',
            },
            {
                label: "#encrypted",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#encrypted',
            },
            {
                label: "signed",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#signed',
            },
            {
                label: "timestamp",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#timestamp',
            },
            {
                label: "meta",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#meta',
            },
            {
                label: "public",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#public',
            },
            {
                label: "it",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                insertText:  '#it',
            },
            {
                label: "with",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'with',
            },
            {
                label: "end",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'end',
            },
            {
                label: "return",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'return',
            },
            {
                label: "value",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'value ',
            },
            {
                label: "type",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'type ',
            },
            {
                label: "origin",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'origin ',
            },
            {
                label: "subscribers",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'subscribers',
            },
            {
                label: "if",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'if ',
            },
            {
                label: "while",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'while',
            },
            {
                label: "else",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'else',
            },
            {
                label: "jmp",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'jmp',
            },
            {
                label: "jtr",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'jtr',
            },
            {
                label: "jfa",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'jfa',
            },
            {
                label: "count",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'count ',
            },
            {
                label: "about",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'about ',
            },
            {
                label: "print",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Function,
                insertText:  '#std.print(${1:})',
                insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
                label: "printf",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Function,
                insertText:  '#std.printf(${1:})',
                insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
                label: "printn",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Function,
                insertText:  '#std.printn(${1:})',
                insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
                label: "read",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Function,
                insertText:  '#std.read(${1:})',
                insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            },
            {
                label: "use",
                kind: MonacoHandler.monaco.languages.CompletionItemKind.Keyword,
                insertText:  'use ${1:} from ',
                insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            }
        ]

        // pointers
        function autocompletePointers(range) {
            const auto_pointer_list = [];
            for (const p of Datex.Pointer.pointers.keys()) {
                auto_pointer_list.push({
                    label: '$'+p,
                    kind: MonacoHandler.monaco.languages.CompletionItemKind.Reference,
                    insertText: '$'+p,
                    range: range
                })
            }
            return auto_pointer_list
        }

        // static scopes
        function autocompleteStaticScopes(range) {
            const list = [];
            for (const [key, scope] of Object.entries(Datex.Runtime.STD_STATIC_SCOPE)) {
                list.push({
                    label: `${key}`,
                    kind: MonacoHandler.monaco.languages.CompletionItemKind.Module,
                    insertText: `#std.${key}`,
                    range: range
                })
                for (const variable of Object.keys(scope)) {
                    list.push({
                        label: `use ${variable} from #std.${key}`,
                        kind: MonacoHandler.monaco.languages.CompletionItemKind.Function,
                        insertText: `use (${variable}) from #std.${key};`,
                        range: range
                    })

                    list.push({
                        label: `${key}.${variable}`,
                        kind: MonacoHandler.monaco.languages.CompletionItemKind.Variable,
                        insertText:  `#std.${key}.${variable}`,
                        insertTextRules: MonacoHandler.monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        range: range
                    })
                }
            }
            return list
        }
                           
        MonacoHandler.monaco.languages.registerCompletionItemProvider('datex', {
            triggerCharacters: ['<'],
            provideCompletionItems: function(model, position) {
                let word = model.getWordUntilPosition(position);
                let range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn-1,
                    endColumn: word.endColumn
                };

                for (const t of auto_types_list)  t.range = range;
                return {suggestions: auto_types_list};
            }
        });

        MonacoHandler.monaco.languages.registerCompletionItemProvider('datex', {
            triggerCharacters: ['$'],
            provideCompletionItems: function(model, position) {
                let word = model.getWordUntilPosition(position);
                return {
                    suggestions: autocompletePointers({
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn-1,
                        endColumn: word.endColumn
                    })
                };
            }
        });

        MonacoHandler.monaco.languages.registerCompletionItemProvider('datex', {
            provideCompletionItems: function(model, position) {
                let word = model.getWordUntilPosition(position);
                return {
                    suggestions: autocompleteStaticScopes({
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    })
                };
            }
        });

        MonacoHandler.monaco.languages.registerCompletionItemProvider('datex', {
            provideCompletionItems: function(model, position) {
                let word = model.getWordUntilPosition(position);
                let range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                for (let t of variables_list)  t.range = range;
                return {suggestions: variables_list};
            }
        });
    }

}