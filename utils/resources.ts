

export type resource_meta = {
    html?:string|HTMLElement, // html content to display
    value?:string, // display value (HTML), optional
    filter_strings?:string[], // string representations of the value that can be used for filtered search
    transparent_filter?: boolean, // don't perform filter operations on this resource
    type?:string,
    braces?:[string, string],
    identifier?: string, // unique value identifying an entry
    reference?:any // reference to any value connected to this entry
    linked?: boolean // is a linked resource
    open?: boolean // handle resource open on click or just expand children

    [key:string]: any
}


/** base class for all general resource (e.g. file or db) management */
export abstract class ResourceManger {

    // can be overridden:
    is_directory_can_change = false; // set to true if directory resources can become normal resources and the other way round

    static resource_managers: Map<string, ResourceManger> = new Map();

    #root_resource: Resource
    #resource_channel: string
    get resource_channel(){return this.#resource_channel}
    get root_resource(){return this.#root_resource}

    static for(resource_channel: string) {
        if (!this.resource_managers.has(resource_channel)) throw new Error("Cannot access resource channel '"+resource_channel+"://'")
        return this.resource_managers.get(resource_channel)
    }

    // resource_channel: e.g. file://
    constructor(resource_channel: string) {
        this.#resource_channel = resource_channel.replace(/:\/\/$/, '');
        ResourceManger.resource_managers.set(this.#resource_channel, this);
        this.#root_resource = Resource.get(this.#resource_channel + "://");
    }



    /** from JSONTree ***********/
    // get all entries for an identifier
    protected identified_elements: Map<string, Set<Resource>> = new Map(); // tree entries identfied by a unique id

    public getResourcesWithIdentifier(identifier:string):Set<Resource> {
        return this.identified_elements.get(identifier)||new Set();
    }

    public bindResourceToIdentifier(resource:Resource, identifier:string) {
        if (!this.identified_elements.has(identifier)) this.identified_elements.set(identifier, new Set());
        this.identified_elements.get(identifier).add(resource)
    }

    /** *********************** */

    // update listeners
    resource_rename_listeners:Map<Resource, Set<(resource:Resource)=>void>> = new Map();
    rename_listeners:Set<(resource:Resource)=>void> = new Set();
    addRenameListenerFor(resource: Resource, listener:(resource:Resource)=>void){
        if (!this.resource_rename_listeners.has(resource)) this.resource_rename_listeners.set(resource, new Set());
        this.resource_rename_listeners.get(resource).add(listener);
    }
    addRenameListener(listener:(resource:Resource)=>void){
        this.rename_listeners.add(listener);
    }

    resource_new_resource_listeners:Map<Resource, Set<(resource:Resource)=>void>> = new Map();
    new_resource_listeners:Set<(resource:Resource)=>void> = new Set();
    addNewResourceListenerFor(resource: Resource, listener:(resource:Resource)=>void){
        if (!this.resource_new_resource_listeners.has(resource)) this.resource_new_resource_listeners.set(resource, new Set());
        this.resource_new_resource_listeners.get(resource).add(listener);
    }
    addNewResourceListener(listener:(resource:Resource)=>void){
        this.new_resource_listeners.add(listener);
    }

    resource_remove_listeners:Map<Resource, Set<(resource:Resource)=>void>> = new Map();
    remove_listeners:Set<(resource:Resource)=>void> = new Set();
    addRemoveListenerFor(resource: Resource, listener:(resource:Resource)=>void){
        if (!this.resource_remove_listeners.has(resource)) this.resource_remove_listeners.set(resource, new Set());
        this.resource_remove_listeners.get(resource).add(listener);
    }
    addRemoveListener(listener:(resource:Resource)=>void){
        this.remove_listeners.add(listener);
    }

    resource_update_listeners:Map<Resource, Set<(resource:Resource)=>void>> = new Map();
    update_listeners:Set<(resource:Resource)=>void> = new Set();
    addUpdateListenerFor(resource: Resource, listener:(resource:Resource)=>void){
        if (!this.resource_update_listeners.has(resource)) this.resource_update_listeners.set(resource, new Set());
        this.resource_update_listeners.get(resource).add(listener);
    }
    addUpdateListener(listener:(resource:Resource)=>void){
        this.update_listeners.add(listener);
    }


    // resource update handlers
    async onResourceNameChanged(resource: Resource, name:any) {
        let parent = resource;
        do {
            if (this.resource_rename_listeners.has(parent)) {
                for (let listener of this.resource_rename_listeners.get(parent)) listener(resource);
            } 
        } while(parent=parent.parent)
        
        for (let listener of this.rename_listeners) listener(resource)
    }

    async onNewResource(path:string, meta:resource_meta) {
        let resource = Resource.get(this.resource_channel+'://'+path, meta);
        await resource.parent.updateChildren(false); // update children in parent

        let parent = resource;
        do {
            if (this.resource_new_resource_listeners.has(parent)) {
                for (let listener of this.resource_new_resource_listeners.get(parent)) listener(resource);
            } 
        } while(parent=parent.parent)
        
        for (let listener of this.new_resource_listeners) listener(resource)
    }
    async onResourceRemoved(resource: Resource) {
        let parent = resource;
        do {
            if (this.resource_remove_listeners.has(parent)) {
                for (let listener of this.resource_remove_listeners.get(parent)) listener(resource);
            } 
        } while(parent=parent.parent)
        
        for (let listener of this.remove_listeners) listener(resource)
    }

    async onResourceUpdated(resource: Resource) {
        await resource.reload(); // force reload resource
        let parent = resource;
        do {
            if (this.resource_update_listeners.has(parent)) {
                for (let listener of this.resource_update_listeners.get(parent)) listener(resource);
            } 
        } while(parent=parent.parent)
        
        for (let listener of this.update_listeners) listener(resource)
    }
    

    // @implement methods

    abstract addResource(resource: Resource, value: any): Promise<void>|void // create a new resource with a value
    abstract addResourceDirectory(resource: Resource): Promise<void>|void // create a new directory resource 
    abstract getResourceValue(resource: Resource): Promise<any>|any // return the value for a resource
    abstract getMetaData(resource: Resource): Promise<object>|object// return the metadata for a resource
    abstract isDirectory(resource: Resource): Promise<boolean>|boolean // return if is a directory (can not rely on the / at the end of a path!), only required if a resource can change its type to/from directory
    abstract setResourceValue(resource: Resource, value:any): Promise<void>|void // update the value of a resource
    abstract getChildren(resource: Resource, update_meta:boolean): (Promise<(string | [string, resource_meta])[]>)|((string | [string, resource_meta])[]) // return a list of all children
    abstract renameResource(resource: Resource, new_name: string): Promise<void>|void // change the name of a resource
    abstract deleteResource(resource: Resource): Promise<void>|void // remove the resource completely (might remove children aswell)
    abstract moveResource(resource: Resource, new_path: string): Promise<void>|void // move a resource to a different path

}


// handles all resources + resource paths

export class Resource {

    static DEFAULT_CHANNEL = "res"

    static resources:Map<string, Resource> = new Map();

    #channel: string = Resource.DEFAULT_CHANNEL
    #path_array: string[] // list of all parents
    #path: string // full path as string
    #default_path: string // path without resource channel
    #name:string  // resource name
    #extension: string // resource name extension
    #is_directory: boolean = false;
    #children: Set<Resource>
    #parent: Resource
    #value: any
    #object_url: string

    resource_manager: ResourceManger

    meta: resource_meta = {}

    get channel(){return this.#channel}
    get path_array(){return this.#path_array}
    get path(){return this.#path}
    get default_path(){return this.#default_path}
    get name(){return this.#name}
    get extension(){return this.#extension}
    get is_directory(){return this.#is_directory}

    get object_url():Promise<string>|string {
        if (this.#object_url) return this.#object_url;
        return new Promise(async resolve=>{
            let options:any = {}
            // workaround: fix svg/pdf display issues
            if (this.extension == "svg") options.type = 'image/svg+xml';
            if (this.extension == "pdf") options.type = 'application/pdf';

            if (await this.value instanceof ArrayBuffer)  this.#object_url = URL.createObjectURL(new Blob([await this.value], options));
            resolve(this.#object_url);
        })

    }

    #_external_meta_loaded = false;
    // force get all meta!, also from remote async servers
    async loadAllMeta():Promise<any> {
        if (this.#_external_meta_loaded) return this.meta;
        else {
            const meta = await this.resource_manager.getMetaData(this);
            if (meta) this.setMeta(meta);
            this.#_external_meta_loaded = true;
            return this.meta;
        }
     
    }

    get parent():Resource {
        if (this.path_array.length == 0) return null; // root reached
        if (!this.#parent) this.#parent = Resource.get(Resource.generatePath(this.channel, this.path_array.slice(0,-1), true));
        return this.#parent;
    }
    // async!
    get children():Promise<Set<Resource>>|Set<Resource> {
        if (!this.is_directory) return null;
        if (this.#children) return this.#children;
        else {
            return this.updateChildren();
        }
    }

    // force update if is directory
    async updateIsDirectory(): Promise<boolean>{
        let res = await this.resource_manager.isDirectory(this)
        // directory changed to true
        if (res === true && !this.is_directory) {
            this.#is_directory = true;
            this.#default_path = Resource.generateDefaultPath(this.#path_array, this.#is_directory);
            this.#path = Resource.generatePath(this.#channel, this.#path_array, this.#is_directory);
            Resource.resources.set(this.#path, this); // update in path map
        }
        // directory changed to false
        else if (res === false && this.is_directory) {
            this.#is_directory = false;
            this.#default_path = Resource.generateDefaultPath(this.#path_array, this.#is_directory);
            this.#path = Resource.generatePath(this.#channel, this.#path_array, this.#is_directory);
            Resource.resources.set(this.#path, this); // update in path map
        }
        return this.#is_directory;
    }

    async updateChildren(update_meta=true){
        await this.loadAllMeta() // first make sure that all meta data is loaded
        this.#children = new Set((await this.resource_manager.getChildren(this, update_meta))?.map((value)=>(value instanceof Array)? Resource.get(this.#channel+"://"+value[0], value[1]) : Resource.get(this.#channel+"://"+value)));
        return this.#children
    }

    private static generatePath(channel:string, path_array:string[], is_directory:boolean) {
        return `${channel}://${Resource.generateDefaultPath(path_array, is_directory)}`
    }
    private static generateDefaultPath(path_array:string[], is_directory:boolean) {
        return path_array.length ? `/${path_array.join('/')}${is_directory ? '/' : ''}` : '/';
    }
    private static generateChildPath(channel:string, path_array:string[], is_directory:boolean, child_name:string) {
        return this.generatePath(channel, [...path_array, child_name], is_directory)
    }
    private static generateChildDefaultPath(path_array:string[], is_directory:boolean, child_name:string) {
        return this.generateDefaultPath([...path_array, child_name], is_directory)
    }

    private static normalizePath(path: string) {
        let path_array = path.replace(/^\w*:\/\//, '').split("/").filter(value=>!!value);
        let channel_match = path.match(/^\w*(?=:\/\/)/)
        let channel;
        if (channel_match) channel = channel_match[0];
        else channel = this.DEFAULT_CHANNEL;
        let is_directory = path.endsWith("/");
        return Resource.generatePath(channel, path_array, is_directory);
    }

    // method to get a resource (only loads the path at first)
    public static get(path:string, meta?: any) {
        if (!path) throw Error("No resource path provided")
        path = Resource.normalizePath(path);
        //console.log("RESOURCE: " + path, meta);
        let resource = Resource.resources.has(path) ? Resource.resources.get(path) : new Resource(path);
        if (meta) resource.setMeta(meta); // directly added meta
        return resource;
    }


    // reload the resource data (children, value, meta)
    public async reload(){
        this.#_external_meta_loaded = false;
        await Promise.all([this.loadAllMeta(), this.getValue()])
        // first check if directory
        if (this.resource_manager.is_directory_can_change) await this.updateIsDirectory();
        // now also update children
        if (this.is_directory) await this.updateChildren()
    }

    // get a child with a specific name
    public async getChild(name:string) {
        if (name.startsWith("./")) name = name.slice(2);
        if (!this.is_directory) throw Error("Cannot get a child from a non-directory resource")
        for (let child of await this.children) {
            if (child.name === name) return child;
        }
        return Resource.get(this.path+name);
    }

    private constructor(path:string) {
        if (path.endsWith("/")) this.#is_directory = true;
        this.setOwnPathFromString(path)
        Resource.resources.set(this.#path, this);
        this.resource_manager = ResourceManger.for(this.#channel);
    }

    private setOwnPathFromString(path: string){
        // add channel if provided
        let channel = path.match(/^\w*(?=:\/\/)/);
        if (channel) this.#channel = channel[0];
        
        this.#path_array = path.replace(/^\w*:\/\//, '').split("/").filter(value=>!!value);
        this.#name = this.#path_array[this.#path_array.length-1] || "";
        if (this.#name && !this.#is_directory && !this.#name.startsWith(".")) {
            let name_parts = this.#name.split(".");
            this.#extension = name_parts[name_parts.length-1]
        }
        this.#default_path = Resource.generateDefaultPath(this.#path_array, this.#is_directory);
        this.#path = Resource.generatePath(this.#channel, this.#path_array, this.#is_directory);
    }


    public setMeta(meta:resource_meta) {
        if (typeof meta != "object") throw Error("meta needs to be an object");
        for (let [key, value] of Object.entries(meta)) {
            this.meta[key] = value;
        }
        // update identifier
        if (meta.identifier) this.resource_manager.bindResourceToIdentifier(this, meta.identifier);
    }

    public isChildOf(other: Resource) {
        return other.is_directory && this.path.startsWith(other.path);
    }


    // change handler, also listen for all children
    public listenForNewResources(listener:(resource:Resource)=>void){
        this.resource_manager.addNewResourceListenerFor(this, listener);
    }
    public listenForRemove(listener:(resource:Resource)=>void){
        this.resource_manager.addRemoveListenerFor(this, listener);
    }
    public listenForUpdates(listener:(resource:Resource)=>void){
        this.resource_manager.addUpdateListenerFor(this, listener);
    }
    public listenForRename(listener:(resource:Resource)=>void) {
        this.resource_manager.addRenameListenerFor(this, listener);
    }

    // onRename: triggered when this resource was renamed (rename() called), not triggered on children renames like 'listenForRename'
    rename_listeners:Set<()=>void> = new Set();
    public onRename(listener:()=>void) {
        this.rename_listeners.add(listener)
    }

    // resource actions

    public async rename(new_name: string) {
        new_name = new_name.replace(/\//g, ''); // format new name
        Resource.resources.delete(this.path); // delete old name from list
        await this.resource_manager.renameResource(this, new_name); 
        // update
        this.#name = new_name;
        if (this.#name && !this.is_directory && !this.#name.startsWith(".")) {
            let name_parts = this.#name.split(".");
            this.#extension = name_parts[name_parts.length-1]
        }
        this.#path_array[this.#path_array.length-1] = new_name;
        this.#default_path = Resource.generateDefaultPath(this.#path_array, this.#is_directory);
        this.#path = Resource.generatePath(this.#channel, this.#path_array, this.#is_directory);
        Resource.resources.set(this.#path, this);

        // rename listeners
        for (let l of this.rename_listeners) l()
    }

    public async move(new_path: string) {
        Resource.resources.delete(this.path); // delete old name from list
        await this.resource_manager.moveResource(this, new_path); 

        this.setOwnPathFromString(new_path); // update path

        Resource.resources.set(this.#path, this);
    }

    public async delete() {
        Resource.resources.delete(this.path)
        return await this.resource_manager.deleteResource(this)
    }

    // same as get this.value, but force fetch resource again
    public async getValue(){
        this.#value = await this.resource_manager.getResourceValue(this);
        return this.#value;
    }

    // same as this.value, but send updates to server
    public async setValue(value:any){
        this.#value = await this.resource_manager.getResourceValue(this);
        await this.resource_manager.setResourceValue(this, value)
    }

    set value(value:any) {
        new Promise(async resolve=>{
            this.#value = value;
        })
    }

    get value():Promise<any> {
        if (this.#value) return this.#value
        else return this.getValue()
    }

    public async addChild(name: string, value?: any):Promise<Resource> {
        await this.resource_manager.addResource(Resource.get(Resource.generateChildDefaultPath(this.path_array, false, name)), value);
        return Resource.get(Resource.generateChildPath(this.channel, this.path_array, false, name));
    }

    public async addChildDirectory(name: string):Promise<Resource> {
        await this.resource_manager.addResourceDirectory(Resource.get(Resource.generateChildDefaultPath(this.path_array, true, name)));
        return Resource.get(Resource.generateChildPath(this.channel, this.path_array, true, name));
    }
    
    public toString(){
        return this.path;
    }

}
globalThis.Resource = Resource;

class DefaultResourceManger extends ResourceManger {
    addResource(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    addResourceDirectory(resource: Resource): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getResourceValue(resource: Resource): Promise<any> {
        throw new Error("Method not implemented.");
    }
    getMetaData(resource: Resource): Promise<object> {
        throw new Error("Method not implemented.");
    }
    isDirectory(resource: Resource): Promise<boolean> {
        throw new Error("Method not implemented.");
    }
    setResourceValue(resource: Resource, value: any): Promise<void> {
        throw new Error("Method not implemented.");
    }
    getChildren(resource: Resource): Promise<(string | [string, resource_meta])[]> {
        throw new Error("Method not implemented.");
    }
    renameResource(resource: Resource, new_name: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    deleteResource(resource: Resource): Promise<void> {
        throw new Error("Method not implemented.");
    }
    moveResource(resource: Resource, new_path: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
}
new DefaultResourceManger("res://"); // init default resource manager