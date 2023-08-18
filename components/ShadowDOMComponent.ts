// deno-lint-ignore-file no-async-promise-executor
import { UIXComponent } from "./UIXComponent.ts"

// deno-lint-ignore no-namespace
export namespace ShadowDOMComponent {
    export interface Options extends UIXComponent.Options {

    }
}


@Component
/**
 * @deprecated use UIXComponent
 */
export class ShadowDOMComponent<O extends ShadowDOMComponent.Options = ShadowDOMComponent.Options, ChildElement extends HTMLElement = HTMLElement> extends UIXComponent<O, ChildElement> {
    

}