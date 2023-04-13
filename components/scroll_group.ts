// deno-lint-ignore-file no-namespace
import { Group } from "./group.ts"
import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { I } from "../uix_short.ts";

export namespace ScrollGroup {
    export interface Options extends Group.Options {
        scroll_background?: string
    }
}

@UIXGroup("Groups")
@Component<Group.Options>({
    icon: I('fa-layer-group'),
})
@NoResources
export class ScrollGroup<O extends ScrollGroup.Options = ScrollGroup.Options> extends Group<O> {

    override onCreateLayout(){
        // this.slot_element.style.display = 'block';
        // this.slot_element.style.overflowY = 'scroll';

        const outer = this.makeScrollContainer(this.content);

        if (this.options.scroll_background) {
            this.content.style.background = this.options.scroll_background;
            this.content.style.backgroundAttachment = "local";
            this.content.style.display = "block";
        }
        
        this.content_container.append(outer);
    }

    public override adjustChildLayout(element: Base) {

        element.style.position = "relative";

        if (element.dynamic_size) element.style.height = "auto";
        else if (element.constraints.h) element.style.height = (element.constraints.h+element.padding_top+element.padding_bottom)+"px";
        else element.style.height = "100%";
    }

}