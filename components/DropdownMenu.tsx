// deno-lint-ignore-file no-namespace
import { htmlElementAttributeValues } from "../html/attributes.ts"
import { UIX } from "uix";
import { BaseComponent } from "./BaseComponent.ts"

export namespace DropdownMenu {
	export interface Options extends BaseComponent.Options {

	}
}

@Component<DropdownMenu.Options>({
	
})
export class DropdownMenu extends BaseComponent<DropdownMenu.Options, never> {

}