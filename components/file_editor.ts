import { Abstract, Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Utils } from "../base/utils.ts";

import { S } from "../uix_short.ts";
import { Types } from "../utils/global_types.ts";
import { Resource } from "../utils/resources.ts";
import { logger } from "../utils/global_values.ts";


export namespace FileEditor {
    export interface Options extends Base.Options {
        path?: string // file source (internal path)
        url?: string // file source (web url)
        editable?:boolean
    }
}


@UIXGroup("Files")
@Abstract @Component({icon:"fa-file", fill_content:true})
@NoResources
export abstract class FileEditor<O extends FileEditor.Options = FileEditor.Options> extends Base<O> {

    resource: Resource

    // do important initial stuff synchronous when creating this element
    override onInit() {
        this.id = this.options.path;
        this.resource = Resource.get(this.options.path);

        // handle resource rename
        this.resource.onRename(()=>{
            this.options.path = this.resource.path;
            this.id = this.options.path;
            this.updateTitle()
        })
    }

    protected updateTitle(){
        this.icon = Utils.getResourceIcon(this.resource);
        this.title = this.resource.name
    }

    // return additional context menu items
    protected override createContextMenu() {
        return {
            ...this.createEditContextMenu(),
            space: <Types.context_menu_item>"space",
            save_file: {
                text: S('save_changes'),
                shortcut: "save",
                handler: ()=>{
                    this.saveFile()
                },
            },
            reveal_in_tree: {
                text: S('reveal_in_tree'),
                handler: null,
            },
        }
    }

    /** Can be implemented */
    protected abstract createEditContextMenu():Types.context_menu

    /** implement: return the current file content to be saved **/
    protected abstract saveFile()


    public async loadFile(path_or_resource:string|Resource): Promise<boolean> {
        if (!path_or_resource) {
            logger.error("provided file path is empty");
            return false;
        }
        let resource = path_or_resource instanceof Resource ? path_or_resource : Resource.get(path_or_resource);
        let exists = true; // TODO check!!
        if (!exists) {
            logger.error("file "+ path_or_resource +" does not exist");
            return false;
        }
        this.resource = resource;
        this.options.path = resource.path;
        this.id = this.options.path;
        this.updateTitle()

        this.content.innerHTML = "";

        return true;
    }



    public override async onCreate() {
        // UIX.Handlers.handleShortcut(this.html_element, "save", ()=>this.saveFile())

        // load file
        let valid = await this.loadFile(this.options.path)
        if (!valid) {
            logger.error("File not valid!")
            this.remove();
        }
    }
}
