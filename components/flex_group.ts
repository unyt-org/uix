import { Group } from "./group.ts"
import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { HTMLUtils } from "../html/utils.ts";
import { I } from "../uix_short.ts";

export namespace FlexGroup {
    export interface Options extends Group.Options {
        gaps?: number,
        direction?: "row"|"column",
        scroll?: boolean
    }
}

@UIXGroup("Groups")
@Component<FlexGroup.Options>({
    sealed: true, 
    icon: I('fa-layer-group'),
    enable_drop: true,
    bg_color: "transparent",
    border: false,
    direction: 'column'
})
@NoResources
export class FlexGroup<O extends FlexGroup.Options=FlexGroup.Options, ChildElement extends Base = Base> extends Group<O, ChildElement> {

    override onCreateLayout(){
        // handle scroll event, otherwise events pass through
        if (!this.options.scroll) this.style.pointerEvents = 'none';

        this.content.style.display = 'flex';
        HTMLUtils.setCSSProperty(this.content, "flex-direction", this.options.$$.direction);
        this.content.style.position = 'relative';
        this.content.style.width = '100%';
        this.content.style.height = '100%';
        let outer = this.content;
        if (this.options.scroll) {
            this.content.style.height = 'auto';
            // this.slot_element.style.overflow = 'scroll';
            outer = this.makeScrollContainer(this.content);
            this.content_container.append(outer);
        }
        if (this.options.gaps) this.content.style.gap = this.options.gaps + "px";

    }

    public override adjustChildLayout(element: ChildElement) {
        element.style.position = "relative";
        //element.style.width = "100%";

        // get index in parent
        let i = 0; 
        let child:ChildNode|null = element;
        while( (child = child.previousSibling) != null ) i++;
        element.style.zIndex = (50 - i).toString();

        if (element.dynamic_size) {
            element.setSizeDynamic();
            element.style.flexShrink = "0";
        }
        else if (element.constraints.h) element.style.height = (element.constraints.h+element.padding_top+element.padding_bottom)+"px";
        else element.style.height = "100%";
    }

}


