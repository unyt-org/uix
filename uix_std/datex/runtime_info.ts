// deno-lint-ignore-file no-namespace
import { Datex, property, props, text } from "unyt_core";
import { UIX, I, S, SVAL } from "uix";
import MonacoHandler from "../code_editor/monaco.ts";
import { DatexValueTreeView } from "./value_tree_view.ts";
import { dx_value_manager } from "./resource_manager.ts";

// show runtime info
@UIX.Group("Datex")
@UIX.Component<UIX.Components.Base.Options>({
    title:"DATEX Runtime Info", 
    icon:"fa-info-circle", 
    vertical_align: UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align: UIX.Types.HORIZONTAL_ALIGN.LEFT,
    padding: 20
})
@UIX.NoResources
export class DatexRuntimeInfo<O extends UIX.Components.Base.Options = UIX.Components.Base.Options> extends UIX.Components.Base<O> {

    override async onCreate(){

        await this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        this.header = new UIX.Elements.Header([{text: "DATEX Runtime"}])

        const table = UIX.Utils.createHTMLElement('<table class="no-style"></table>');
        table.style.marginTop = "20px";

       
        table.append(UIX.Utils.createHTMLElement(`<tr><td style='width:9em;color:var(--text_color_highlight)'>Version</td><td>${Datex.Runtime.VERSION}</td></tr>`))
        table.append(UIX.Utils.createHTMLElement(`<tr><td style='color:var(--text_color_highlight)'>Running on</td><td>${Datex.Runtime.HOST_ENV}</td></tr>`))
        

        table.append(UIX.Utils.createHTMLElement(`<tr><td style='color:var(--text_color_highlight)'>Endpoint</td><td style='font:14px Menlo, Monaco, "Courier New", monospace'>${await MonacoHandler.colorize(Datex.Runtime.endpoint.toString(), 'datex')}</td></tr>`))


        // OPTIONS
        let options_tree_view = new DatexValueTreeView({
            root_resource_path:(await dx_value_manager.getResourceForValue(Datex.Runtime.OPTIONS)).path,
            padding_left:0, padding_top:0, border:false, header:false, border_radius:0, bg_color:'transparent', enable_drop:false
        }, {dynamic_size: true});
        let options_tr = UIX.Utils.createHTMLElement('<tr><td>Options</td></tr>');
        options_tr.style.color = 'var(--text_color_highlight)'
        let options_td = UIX.Utils.createHTMLElement('<td></td>');
        options_td.style.overflow = "visible";
        options_td.style.paddingBlockStart = "21px";

        options_tr.append(options_td)
        table.append(options_tr)

        // compile time measurements
        //DatexRuntimePerformance.enabled = true; // first enable performance measurements
        // TODO enable + sync
        let compile_obj = Datex.RuntimePerformance.getMeasureGroup("compile time");
        let compile_time_tree_view = new DatexValueTreeView({
            root_resource_path:(await dx_value_manager.getResourceForValue(compile_obj)).path,
            padding_left:0, padding_top:0, border:false, header:false, border_radius:0, bg_color:'transparent', enable_drop:false
        }, {dynamic_size: true});
        let compile_time_tr = UIX.Utils.createHTMLElement('<tr><td>Compile Time [ms]</td></tr>');
        compile_time_tr.style.color = 'var(--text_color_highlight)'
        let compile_time_td = UIX.Utils.createHTMLElement('<td></td>');
        compile_time_td.style.overflow = "visible";
        compile_time_td.style.paddingBlockStart = "21px";

        compile_time_tr.append(compile_time_td)
        table.append(UIX.Utils.createHTMLElement('<tr style="height:30px"></tr>'));
        table.append(compile_time_tr)

        // Allocated Pointers
        let allocated_pointers_td = UIX.Utils.createHTMLElement(`<td style='font:14px Menlo, Monaco, "Courier New", monospace'>${Datex.Pointer.pointers.size}</td>`);
        let allocated_pointers_tr = UIX.Utils.createHTMLElement(`<tr><td style='color:var(--text_color_highlight)'>Allocated Pointers</td></tr>`)
        allocated_pointers_tr.append(allocated_pointers_td);
        table.append(allocated_pointers_tr)


        // update pointer number
        Datex.Pointer.onPointerAdded(()=>allocated_pointers_td.innerText = (Datex.Pointer.pointers.size).toString())
        Datex.Pointer.onPointerRemoved(()=>allocated_pointers_td.innerText = (Datex.Pointer.pointers.size).toString())

        this.content.append(table);
        options_tree_view.anchor(options_td); // add tree view to html
        compile_time_tree_view.anchor(compile_time_td); // add tree view to html

        // adjust tree view positions
        options_tree_view.style.marginLeft = '-26px';
        options_tree_view.style.marginTop = '-20px';

        compile_time_tree_view.style.marginLeft = '-26px';
        compile_time_tree_view.style.marginTop = '-20px';
    }
}
