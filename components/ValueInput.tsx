// deno-lint-ignore-file no-namespace
import { customAttributeValues } from "../html/attributes.ts"
import { UIX } from "uix";
import { BaseComponent } from "./BaseComponent.ts"
import { HTMLUtils } from "../html/utils.ts";

export namespace ValueInput {
	export interface Options extends BaseComponent.Options {
		type?: customAttributeValues['input']['type'],
		placeholder?: string
	}
}

@Component<ValueInput.Options>({
	class: "value-input",
	type: "text"
})
export class ValueInput extends BaseComponent<ValueInput.Options, never> {

	@standalone @property count = 0;
	@standalone @layout input = <input onclick={()=>this.onClick()} type={this.options.type} placeholder={this.options.placeholder}/>
	
	@standalone onClick() {
		console.log("click", this.count++)
	}

}