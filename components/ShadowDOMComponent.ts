// deno-lint-ignore-file no-async-promise-executor
import { BaseComponent } from "./BaseComponent.ts"

// deno-lint-ignore no-namespace
export namespace ShadowDOMComponent {
    export interface Options extends BaseComponent.Options {

    }
}


@Component
/**
 * @deprecated use UIX.BaseComponent
 */
export class ShadowDOMComponent<O extends ShadowDOMComponent.Options = ShadowDOMComponent.Options, ChildElement extends HTMLElement = HTMLElement> extends BaseComponent<O, ChildElement> {
    

}