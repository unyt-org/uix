import { UIXComponent } from "uix/components/UIXComponent.ts";
import { template } from "uix/html/anonymous-components.ts";


const count = $$(0);

@template<{name:string}>(({name}) =>
	<div>
		<h1>Hello {name}</h1>
		Hello Component
		<p>
		Counter: {count}
		</p>
		<button onclick:display={()=>this.myMethod()}>Increase Counter</button>
	</div>
)
export class HelloComponent extends UIXComponent<{name:string}> {

	@content val = <div>CONTENT <b>{count}</b></div>

	@property x = 10;
	y = 10;

	@property myMethod() {

	}
}