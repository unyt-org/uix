import { Component, NoResources, Group as UIXGroup } from "../base/decorators.ts"
import { DragGroup } from "./drag_group.ts";
import { Node } from "./node.ts";


@UIXGroup("Nodes")
@Component<Node.Options>({
    title: "Node Group",
    icon: 'fa-network-wired',
    bg_color: '#1f6eb58a'
}, {
    resizable: true,
    w: 100,
    h: 100,
    zlayer: -1
})
@NoResources
export class GroupingNode<O extends Node.Options=Node.Options> extends Node<O> {

    #last_x:number;
    #last_y:number

    protected override onConstraintsChanged() {
        super.onConstraintsChanged();

        // update childs (only if lastx already saved)
        if (this.#last_x!=undefined && this.parent instanceof DragGroup) {
            const dx = this.constraints.x - this.#last_x;
            const dy = this.constraints.y - this.#last_y;

            let els = this.parent.getContainedElements(this);
            for (let el of els) {
                el.constraints.x += dx;
                el.constraints.y += dy;
            }
        }

        this.#last_x = this.constraints.x;
        this.#last_y = this.constraints.y;
    }

}
