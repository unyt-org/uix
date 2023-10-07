import { UIXComponent } from "uix/components/UIXComponent.ts";
import { UIX } from "uix/uix.ts";

@UIX.template<{name:string}>(({name}) =>
	<div>
		<h1>Hello {name}</h1>
		Hello Component
	</div>
)
export class HelloComponent extends UIXComponent<{name:string}> {

	@content val = <div>CONTENT</div>
}

