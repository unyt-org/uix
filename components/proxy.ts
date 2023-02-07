import { Component, Abstract, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";

// TODO: cannot name 'Proxy' -> typescript generates code which creates stack overflow?!!
export namespace ComponentProxy {
    export interface Options extends Base.Options {
        component?: Base
    }
}

// proxy element,represents another element, but is displayed differently
@Component @Abstract @NoResources
export abstract class ComponentProxy<O extends ComponentProxy.Options = ComponentProxy.Options> extends Base<O> {

    public override onCreate() {
        if (this.options.component) this.title = this.options.component.constructor.name
        this.content.innerHTML = `Proxy Element for ${this.options.component?.constructor.name ?? "Unknown"}`;
    }

}

