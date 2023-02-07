/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Node Editor Base Classes - UIX Standard Lib                                         ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  Visit https://docs.unyt.cc/uix for more information                                 ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2022 unyt.org                        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */
// ---
import { Datex, property } from "unyt_core";
import {UIX} from "../../uix.ts";


@UIX.Group("Node Editor")
@UIX.Component({
    title: "Node Editor Top Menu",
    padding: 15,
    border: false,
    bg_color: UIX.Theme.getColorReference("bg_dark"),
}, {dynamic_size:true, margin:10})
@UIX.NoResources
export class NodeEditorTopMenu<O extends UIX.Components.Base.Options = UIX.Components.Base.Options> extends UIX.Components.Base<O> {

    protected override onCreate() {
        this.content.style.display = "flex";
        this.content.style.alignItems = "center";

        const title = new UIX.Elements.Text(<Datex.Value<string>>this.options_props.title).css({
            'font-size': '20px',
            'margin': '0',
            'margin-right': '30px',
            'font-family': 'Roboto, sans-serif',
            'color': UIX.Theme.getColorReference('text_highlight')
        })

        this.content.append(title);
    }        

}


@UIX.Group("Node Editor")
@UIX.Component({
    title: "Node Editor Left Menu",
    padding: 15,
    //border: false,
    bg_color: '#2026368c',
    border_color: UIX.Theme.getColorReference("bg_dark")
})
@UIX.NoResources
export class NodeEditorLeftMenu<O extends UIX.Components.Base.Options = UIX.Components.Base.Options> extends UIX.Components.Base<O> {

    protected override onCreate() {

        const title = new UIX.Elements.Text(<Datex.Value<string>>this.options_props.title).css({
            'font-size': '20px',
            'margin': '0',
            'margin-right': '30px',
            'font-family': 'Roboto, sans-serif',
            'color': UIX.Theme.getColorReference('text_highlight')
        })

        this.content.append(title);
    }        

}



@UIX.Group("Node Editor")
@UIX.Component({
    title: "Node Editor Right Menu",
    padding: 15,
    //border: false,
    bg_color: '#2026368c',
    border_color: UIX.Theme.getColorReference("bg_dark")
})
@UIX.NoResources
export class NodeEditorRightMenu<O extends UIX.Components.Base.Options = UIX.Components.Base.Options> extends UIX.Components.Base<O> {

    protected override onCreate() {
    
        const title = new UIX.Elements.Text(<Datex.Value<string>>this.options_props.title).css({
            'font-size': '20px',
            'margin': '0',
            'margin-right': '30px',
            'font-family': 'Roboto, sans-serif',
            'color': UIX.Theme.getColorReference('text_highlight')
        })

        this.content.append(title);
    }        

}



@UIX.Group("Node Editor")
@UIX.Component({
    title: "Node Editor",
    rows: [1],
    columns: [1]
})
@UIX.NoResources
export class NodeEditor<O extends UIX.Components.GridGroup.Options = UIX.Components.GridGroup.Options> extends UIX.Components.GridGroup<O> {

    protected node_group_class: {new (...args: any[]): UIX.Components.NodeGroup} = UIX.Components.NodeGroup
    protected top_menu_class: {new (...args: any[]): NodeEditorTopMenu} = NodeEditorTopMenu
    protected left_menu_class: {new (...args: any[]): NodeEditorLeftMenu} = NodeEditorLeftMenu
    protected right_menu_class: {new (...args: any[]): NodeEditorRightMenu} = NodeEditorRightMenu

    @property public node_group:UIX.Components.NodeGroup
    @property public top_menu:NodeEditorTopMenu
    @property public left_menu:NodeEditorLeftMenu
    @property public right_menu:NodeEditorRightMenu

    protected override generateChildren() {
        const side_menus = [];

        if (this.left_menu_class) side_menus.push(new UIX.Components.GridGroup({rows:[1],columns:[1,0.1], sealed:false, responsive:false}, {}, [
            this.left_menu = new (this.left_menu_class)()
        ]))

        if (this.right_menu_class) side_menus.push(new UIX.Components.GridGroup({rows:[1],columns:[0.1,1], sealed:false, responsive:false}, {gx:2}, [
            this.right_menu = new (this.right_menu_class)({}, {gx:1})
        ]))

        return [

            // node group
            this.node_group = new (this.node_group_class)(),

            // menu overlay
            new UIX.Components.FlexGroup({}, {gx:0,gy:0}, [
                this.top_menu = new (this.top_menu_class)(),
                new UIX.Components.GridGroup({rows:[1],columns:[1,3,1],padding:10, padding_top:0}, {}, side_menus),
            ])
        ]
    }

}