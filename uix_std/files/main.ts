
/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  TreeView and FileTreeView - UIX Standard Lib                                        ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║                                                                                      ║
 ║  Visit https://docs.unyt.cc/uix for more information                                 ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---

import {UIX} from "../../uix.ts";
import {S, SVAL, S_HTML, I} from "../../uix_short.ts";

UIX.Res.addStrings({
    en: {
        files: 'Files',
    },
    de: {
        files: 'Dateien',
    },
})

async function loadExternalFiles(drop_event_data, load_callback:(file_name:string, content)=>void) {
    if (!load_callback) return;
    for (let file_data of drop_event_data) {
        let reader = new FileReader();
        reader.addEventListener('load', e => {
            load_callback(file_data.name, e.target.result);
        });
        reader.readAsText(file_data);
    }
}



@UIX.Group("Files")
@UIX.Component<UIX.Components.Tree.Options>({
    icon: 'fa-list',
    title: S('files'),
    vertical_align: UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align: UIX.Types.HORIZONTAL_ALIGN.LEFT,
    header:true,
    search: true
})
@UIX.NoResources
export class FileTreeView<O extends UIX.Components.Tree.Options = UIX.Components.Tree.Options> extends UIX.Components.Tree<O> {

    protected not_allowed_entry_chars = ["/", "\\", "*", ";", "'", "\"", ":", "|", "`"]

    protected createContextMenuBody(resource: UIX.Resource) {
        if (resource.is_directory) return {
            add_file: {
                text: S`add_file`, icon: 'fa-plus', shortcut: "add",
                handler: async ()=>{
                    let child = await resource.addChild("unnamed.txt")
                    this.handleEntryEdit(child, true)
                }
            },
            add_dir: {
                text: S`add_dir`, icon: 'fa-plus',
                handler: async ()=>{
                    let child = await resource.addChildDirectory("unnamed")
                    this.handleEntryEdit(child)
                }
            },
            delete_dir: {
                text: S`delete_dir`, shortcut: "delete",
                disabled: resource.meta.type=="espruino"||resource.meta.type=="project_dir",
                handler: async ()=> this.onEntryDelete(resource)
            },
            rename_dir: {
                text: S`rename_dir`, shortcut: "rename",
                disabled: resource.meta.type=="espruino"||resource.meta.type=="project_dir",
                handler: ()=>this.handleEntryEdit(resource)
            },
            copy_dir: {
                text: S`copy_dir`, shortcut: "copy",
                disabled: resource.meta.type=="espruino"||resource.meta.type=="project_dir",
                handler: ()=>{
                    UIX.Utils.writeFileToClipboard(resource.path, "");
                }
            },
            copy_dir_path: {
                text: S`copy_dir_path`,
                disabled: resource.meta.type=="espruino"||resource.meta.type=="project_dir",
                handler: async ()=> {
                    // @ts-ignore
                    await navigator.permissions.query({name: "clipboard-write"})
                    navigator.clipboard.writeText(resource.path + '⁣⁣⁣⁣⁣⁣')
                }
            },
            paste: {
                text: S`paste`, shortcut: "paste",
                disabled: resource.meta.type=="espruino"||resource.meta.type=="project_dir",
                handler: async ()=>{
                    let clipboard = await UIX.Utils.getClipboardData();
                    if (clipboard.types.has(UIX.Types.DRAGGABLE.TREE_ITEM)) {
                        let path = clipboard.data[UIX.Types.DRAGGABLE.TREE_ITEM];

                    }
                    // TODO
                    // await FileHandler.copyPath(path, el.path);
                }
            },
        }
        else return {
            delete_file: {
                text: S`delete_file`, shortcut: "delete",
                handler: ()=>this.onEntryDelete(resource)
            },
            rename_file: {
                text: S`rename_file`, shortcut: "rename",
                handler:  ()=>this.handleEntryEdit(resource)
            },
            copy_file: {
                text: S`copy_file`, shortcut: "copy",
                handler: ()=>{
                    UIX.Utils.writeFileToClipboard(resource.path, "");
                }
            },
            copy_file_path: {
                text: S`copy_file_path`,
                handler: async ()=> {
                    // @ts-ignore
                    await navigator.permissions.query({name: "clipboard-write"})
                    navigator.clipboard.writeText(resource.path + '⁣⁣⁣⁣⁣⁣')
                }
            }
        }
    }


    protected async onEntryDelete(resource:UIX.Resource) {
        UIX.Actions.dialog(S_HTML('delete_confirm', resource.is_directory ? SVAL`directory` : SVAL`file`) , `<span style="color:${UIX.Utils.getResourceColor(resource)}">${UIX.Utils.getResourceIcon(resource)} ${resource.name}</span>`, [
            {text:"Cancel"},
            {text:"Delete", color:"#ac1928", onClick:async ()=>{
                    await resource.delete()
                    this.collapse(resource);
                }}
        ])
    }


    protected async onEntryMove(resource:UIX.Resource) {
        UIX.Actions.dialog(S_HTML('move_confirm', resource.is_directory ? SVAL`directory` : SVAL`file`) , `<span style="color:${UIX.Utils.getResourceColor(resource)}">${UIX.Utils.getResourceIcon(resource)} ${resource.name}</span>`, [
            {text:"Cancel"},
            {text:"Move", color:"#ac1928", onClick:async ()=>{
                    // TODO
                    this.collapse(resource);
                }}
        ])
    }

    protected async onEntryDrop(resource:UIX.Resource, drop_event) {
        if (drop_event.types.has(UIX.Types.DRAGGABLE.TREE_ITEM)) {
            let move_entry = UIX.Resource.get(drop_event.data[UIX.Types.DRAGGABLE.TREE_ITEM]);
            let to_entry = resource

            UIX.Actions.dialog(S_HTML('move_confirm', move_entry.is_directory ? SVAL`directory` : SVAL`file`) , `
            <div style="text-align: center">
                <span style="color:${UIX.Utils.getResourceColor(move_entry)}">${UIX.Utils.getResourceIcon(move_entry)} ${move_entry.name}</span>
                <br>${I`fa-angle-double-down`}<br>
                <span style="color:${UIX.Utils.getResourceColor(to_entry)}">${UIX.Utils.getResourceIcon(to_entry)} ${to_entry.name}</span>
            </div>
            `, [
                {text:"Cancel"},
                {text:"Move", color:"#1e80b6", onClick:async ()=>{
                        await move_entry.move(to_entry.path)
                }}
            ])

        }

        else if (drop_event.types.has(UIX.Types.DRAGGABLE.EXTERNAL_FILE)) {
            loadExternalFiles(drop_event.data[UIX.Types.DRAGGABLE.EXTERNAL_FILE], (file_name, content)=> {
                // TODO add file
            });
        }
    }

}

