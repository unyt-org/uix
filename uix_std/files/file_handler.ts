import { Logger } from "unyt_core/utils/logger.ts";

// import "./filesystem.ts";
import { expose, f, remote, scope, timeout, to } from "unyt_core";
import { Resource, ResourceManger } from "../../uix_all.ts";

// @ts-ignore
window.requestFileSystem  = window.requestFileSystem || window.webkitRequestFileSystem;

const logger = new Logger("files");




@scope("file_server") @to('@+CODE') abstract class FileServer {

    /**
     * get a file as a blob from the server
     */
    @remote @timeout(20_000) static getFile(path:string): Promise<Blob> {return null}

    /** get children */
    @remote static getChildren(path: string): Promise<[string, any][]> {return null}

    /**
     * update files on server
     * @param path
     */
    @remote @expose static addFile(path: string, content?) {
        FileHandler.addFile(path, content, false, true);
    }

    @remote @expose static addDir(path: string) {
        FileHandler.addDir(path, true);
    }
    @remote @expose static deleteFile(path: string) {
        FileHandler.deleteFile(path, true);
    }

    @remote @expose static async renameFile(path: string, new_name: string) {
        let res = Resource.get(fileManger.resource_channel+"://"+path);
        await res.rename(new_name);
        console.warn("REENAME", path, new_name)
        fileManger.onResourceNameChanged(res, new_name)
    }
    @remote @expose static moveFile(path: string, new_parent: string) {
        FileHandler.moveFile(path, new_parent, true);
    }

    @remote @expose static copyFile(path: string, new_parent: string) {}

    /** update files
     */
    @remote @expose static async updateFile(path: string, content: any):Promise<any> {
        const res = Resource.get(fileManger.resource_channel+"://"+path);
        res.value = content;
        fileManger.onResourceUpdated(res)
    }

}


// file manager based on ResourceManager

class FileManager extends ResourceManger {
    
    getMetaData(resource: Resource): Promise<object> {
        return null;
    }

    isDirectory(resource: Resource): Promise<boolean> {
        return null;
    }

    async addResource(resource: Resource, value: any): Promise<void> {
        await FileServer.to(f('@+CODE')).addFile(resource.default_path, value);
    }
    async addResourceDirectory(resource: Resource): Promise<void> {
        await FileServer.to(f('@+CODE')).addDir(resource.default_path);
    }
    async getResourceValue(resource: Resource): Promise<any> {
        if (resource.is_directory) return null;
        else return await FileServer.to(f('@+CODE')).getFile(resource.default_path);
    }
    async setResourceValue(resource: Resource, value: any): Promise<void> {
        await FileServer.to(f('@+CODE')).updateFile(resource.default_path, value);
    }
    async getChildren(resource: Resource): Promise<(string | [string, any])[]> {
        return (await FileServer.to(f('@+CODE')).getChildren(resource.default_path))
    }
    async renameResource(resource: Resource, new_name: string): Promise<void> {
        await FileServer.to(f('@+CODE')).renameFile(resource.default_path, new_name);
    }
    async deleteResource(resource: Resource): Promise<void> {
        await FileServer.to(f('@+CODE')).deleteFile(resource.default_path);
    }
    async moveResource(resource: Resource, new_path: string): Promise<void> {
        await FileServer.to(f('@+CODE')).moveFile(resource.default_path, new_path);
    }

}

export const fileManger = new FileManager("file://")









window["FileServer"] = FileServer;

/** MAIN class for all file related stuff - server - client - sync ***/
export default abstract class FileHandler {

    static fs;
    static initialized = false;

    /**
     * fetch file tree and request file system
     */
    static async init() {
   
        let requestFileSystem = (grantedBytes: number, callback)=>{
            logger.success("filesystem initialized")

            if (globalThis.requestFileSystem) {
                // @ts-ignore
                globalThis.requestFileSystem(globalThis.PERSISTENT, grantedBytes, async (fs) => {
                    //console.log("request", fs)
                    this.fs = fs;
                    callback()
                    this.initialized = true;
                });
            }
        }

        return new Promise<void>(resolve=>{
            let requestedBytes = 1024*1024*280;

            // @ts-ignore
            if (navigator.webkitPersistentStorage) {
                // window.webkitStorageInfo.requestQuota(window.PERSISTENT, requestedBytes, function(grantedBytes) {
                //     requestFileSystem(grantedBytes, resolve)
                // }, function(e) {
                //     logger.error('Filesystem Error', e);
                // });

                // @ts-ignore
                navigator.webkitPersistentStorage.requestQuota(requestedBytes, grantedBytes => {
                    requestFileSystem(grantedBytes, ()=>{
                        resolve()
                    })
                }, function(e) {
                    logger.error('Filesystem Error', e);
                    resolve()
                });
            }
            else {
                requestFileSystem(requestedBytes, ()=>{
                    resolve()
                })
            }

        })

    }

    /** generic file observer */
    private static file_change_listeners = new Map<string, Set<Function>>();
    public static onFileChanged(path:string, handler: (content:string|ArrayBuffer)=>any) {
        if (!this.file_change_listeners.has(path)) this.file_change_listeners.set(path, new Set());
        this.file_change_listeners.get(path).add(handler);
    }

    /** main file update methods */

    public static async updateFile(path:string, content:string|ArrayBuffer){
        let res = await FileServer.updateFile(path, content);
        this.notifyFileChange(path, content)
        console.log("Server save:", path, res.valid);
        return res;
    }


    public static async notifyFileChange(path: string, content:string|ArrayBuffer){
        for (let h of FileHandler.file_change_listeners.get(path)||[]) h(content)
    }

    public static async addFile(path:string, content=null, is_dir=false, local_only=false): Promise<any>{
    }

    public static async addDir(path:string, local_only=false): Promise<any>{
        return this.addFile(path, null, true, local_only)
    }

    public static async moveFile(path:string, new_parent:string, local_only=false): Promise<any>{
    }


    public static async renameFile(path:string, new_name:string, local_only=false): Promise<any>{
    }

    public static async deleteFile(path:string, local_only=false): Promise<any>{   
    }



    private static async createParentIfNotExists(path) {
        let parent = path.substr(0, path.lastIndexOf("/")) + "/";
        let parent_exists = await this.dirCached(parent);
        if (!parent_exists) {
            logger.info("creating parent directory '" + parent + "'");
            await this.createDir(parent)
        }
    }

    /**
     * check if file is cached
     */

    public static fileCached(path) {
        return new Promise(resolve => {
            this.fs?.root?.getFile(path, {create: false},
                ()=> resolve(true),
                () => resolve(false));
        })
    }

    /**
     * check if directory is cached
     */
    public static dirCached(path) {
        return new Promise(resolve => {
            this.fs?.root?.getDirectory(path, {create: false},
                ()=> resolve(true),
                () => resolve(false));
        })
    }


    private static createDir(path:string|string[], rootDir = this.fs.root) {
        let folders = path;
        if (!(path instanceof Array)) {
            folders = path.split("/");
        }
        if (folders[0] == '.' || folders[0] == '') {
            folders = folders.slice(1);
        }

        if(folders.length==0) return;

        return new Promise(resolve=>{
            rootDir.getDirectory(folders[0], {create: true}, async dirEntry => {
                if (folders.length) {
                    await this.createDir(folders.slice(1), dirEntry);
                }
                resolve(true);
            }, e=>{logger.error("error creating directory", e);resolve(false)});
        })
    };


    /**
     * write a file to the file system
     */
    public static async cacheFile(path) {

        // TODO
        let file_blob = new Blob([await FileServer.getFile(path)]);
        return this._writeFile(path, file_blob);
    }

    private static async writeFileFromUrl(path:string, url:string): Promise<boolean> {
        return this._writeFile(path, await fetch(url).then(r => r.blob()));
    }

    private static async writeFileText(path:string, text:string): Promise<boolean> {
        return this._writeFile(path, new Blob([text], {type: 'text/plain'}));
    }

    private static async _removeFile(path:string) {
        return new Promise(resolve=>{
            this.fs.root.getFile(path, {create: false},
                (fileEntry)=> {
                    fileEntry.remove(()=>resolve(true));
                },
                () => resolve(true));
        })
    }

    private static async _writeFile(path:string, blob:Blob): Promise<boolean> {

        await this.createParentIfNotExists(path);

        // fix for bug?: file is not completely overwritten, if previous size was bigger, the remaining content won't be removed
        await this._removeFile(path);

        return new Promise(resolve=>{
            this.fs.root.getFile(path, {create: true, replace:true}, function(fileEntry) {
                // console.log(fileEntry)
                fileEntry.createWriter( fileWriter => {

                    fileWriter.onwriteend = function(e) {
                        resolve(true)
                    };

                    fileWriter.onerror = function(e) {
                        console.error('Write failed: ', e);
                        resolve(false)
                    };

                    fileWriter.write(blob);
                }, e=>{logger.error("Could not write file", e);resolve(false)});

            }, e=>{logger.error("Could not write file", e);resolve(false)});
        })



    }

   

    public static async getFileContent(path:string): Promise<string|ArrayBuffer>{

        let file = await this.readFile(path);

        return new Promise(resolve=>{
            try {
                let reader = new FileReader();
                reader.onloadend = (e) => {
                    resolve(e.target.result)
                };
                reader.readAsText(file);
            }
            catch (e) {resolve(null)}
        });
    }

    public static async getFileUrl(path:string): Promise<string> {
        let file = await this.readFile(path);
        if (file) return URL.createObjectURL(file);
        else return null;
    }
 
    public static async readFile(path:string):Promise<File>{

        // cache file if not yet cached
        /*if (!await this.fileCached(path))*/ await this.cacheFile(path);

        return new Promise(resolve=>{
            this.fs.root.getFile(path, {}, fileEntry => {
                fileEntry.file(file=>resolve(<File>file), e=>{logger.error(e);resolve(null)});
            }, e=>{logger.error("Could not read file", e);resolve(null)});
        })
    }


    static onInit(fs){
        console.log("file system:", fs)
    }

}

window["FileHandler"] = FileHandler

