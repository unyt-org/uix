import {ConsoleView, LogBuffer} from "uix_std/console/main.ts";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { DatexValueTreeView } from "./value_tree_view.ts";
import { DatexEditor } from "./editor.ts";


export interface DATEX_CONSOLE_OPTIONS extends ConsoleView.CONSOLE_OPTIONS {
    editor?: DatexEditor // use local interface
}

// custom console view
@UIX.Group("Datex")
@UIX.Component<DATEX_CONSOLE_OPTIONS>({
    title:"DATEX Console",
    fill_content: true
}) 
export class DatexConsoleView extends ConsoleView<DATEX_CONSOLE_OPTIONS> {

    override enable_hover = true;
    override tooltip_formatted = false;

    override onHover(pointer_string:string) {
        console.log("pointer hover", pointer_string);
        // create new container for pointer tooltip
        const tree_view = new DatexValueTreeView({padding_left: 10, padding_top:10, padding:10, root_resource_path:"dxptr://"+Datex.Pointer.normalizePointerId(pointer_string)+"/", display_root:true, header:false, title:pointer_string}, {dynamic_size:true})
        const container = document.createElement("div");
        container.style.width = "448px";
        container.style.height = "auto";
        tree_view.anchor(container);
        return container;
    }

    // connect editor log buffer
    public override onInit() {
        super.onInit();
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);
        if (this.options.editor) this.setLogBuffer(this.options.editor.log_buffer);
    }

}
