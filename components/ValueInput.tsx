// deno-lint-ignore-file no-namespace
import { customAttributeValues } from "../html/attributes.ts"
import { BaseComponent } from "./BaseComponent.ts"

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
	@standalone x = "x"
	@standalone @layout input = <input onclick={()=>this.onDisplay()} type={this.options.type} placeholder={this.options.placeholder}/>

	@standalone method1() {
		console.log("1");
	}
	@standalone override onDisplay() {
		console.log("display",this.x)
	}
}