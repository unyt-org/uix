import { Component, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Types } from "../utils/global_types.ts";
import { TextView } from "./text_view.ts";
import { S } from "../uix_short.ts";
import { Components } from "./main.ts";

export namespace ComponentSettings {
    export interface Options extends Base.Options {
        component_name?: string
    }
}

@Component<Components.TabGroup.Options>({
    icon:'fa-cog',
    padding: 25,
    vertical_align:Types.VERTICAL_ALIGN.TOP,
    horizontal_align: Types.HORIZONTAL_ALIGN.LEFT
    //background_color: 'UIX.Theme.background_content_dark'
})
@NoResources
export class ComponentSettings<O extends ComponentSettings.Options = ComponentSettings.Options> extends Base<O> {

    private ref_element:Base;

    declare element_collector:Components.TabGroup


    private async renderSettings() {
        this.element_collector = new Components.TabGroup({header_type:"small", header_title:this.ref_element.constructor.name,/*header_centered:true,*/ editable: false, sealed: true})

        let settings = new TextView({title:S('settings'), text:"Settings", border:false});
        let advanced = new TextView({title:S('advanced'), text:"More Settings", border:false});
        let about    = new TextView({title:S('about'), text:"About this element:", border:false});

        this.element_collector.addChild(settings);
        this.element_collector.addChild(advanced);
        this.element_collector.addChild(about);

        this.element_collector.anchor(this.content);
        this.element_collector.showTab(settings);
    }

    setReferencedElement(ref_element:Base){
        this.ref_element = ref_element;
        this.renderSettings();
    }   

}

