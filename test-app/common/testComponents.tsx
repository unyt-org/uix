import { UIX, unsafeHTML } from "uix/uix.ts";
import { Api, test } from "../backend/public.ts";
import { DropdownMenu } from "uix/components/DropdownMenu.tsx";
import { ValueInput } from "uix/components/ValueInput.tsx";
import { always } from "https://dev.cdn.unyt.org/unyt_core/datex.ts";

/**
 * Put examples for all components in the testComponents object.
 * Every component can be displayed under the paths:
 *   /[key]/frontend 		(Fully rendered on the frontend)
 *   /[key]/backend+static 	(Fully server side rendered)
 *   /[key]/backend+dynamic (Loaded from the backend via DATEX)
 *   /[key]/backend+hydrated
 * 
 * (e.g. http://localhost:4200/textInput/backend+static )
 */



function Container({children}:{children:Element|Element[]}) {
	return <div style={{display:"flex", gap:5, margin:5}}>{...(children instanceof Array ? children : [children])}</div>
}

const x = $$(0);
const y = $$(0);
setInterval(()=>x.val = Math.round(Math.random()*100), 1000);
setInterval(()=>y.val = Math.round(Math.random()*100), 2000);

export const testComponents = {

	textInput: 		<Container><ValueInput placeholder="text 1..."/></Container>,
	dropdownMenu: 	<Container><DropdownMenu/></Container>,

	/** 
	 * Contexts demo:
	 * 
	 * Per default, event listeners are always called in the *original context*
	 * -> When the button is created on the backend and displayed in standalone mode 
	 *    on the frontend, the onclick handler is still called on the *backend*
	 * -> When the button is created and rendered on the frontend, the onclick
	 *    handler is called on the *frontend*
	 * 
 	 * By wrapping it with UIX.inDisplayContext(), the onmousedown handler is always called on
	 * the *frontend*, also in standalone mode
	*/
	contexts: 
		<button 
			onmousedown={UIX.inDisplayContext(() => console.log("mouse down"))} 
			onmouseup={Api.method1}
			onclick={async e => {
				console.log("clicked",e);
				const x = await test(10);
				console.log("res",x)
			}}
		>
			Click Me
		</button>,

	html: <div>
		{HTML `
			<h3>Header</h3>
			<p>
				<a href="/link">Link</a><br/>
				${1234}<br/>
				${"test content"}
			</p>
		`}
		{unsafeHTML('<div>Unsafe HTML<script type="text/javascript">alert(1)</script></div>')}
	</div>,

	datex:
		<h3>
			{x} + {y} = 
			<datex>{x}+{y}</datex>
			<br/>
			{always `${x} + ${y}`}
			<br/>
			{datex `<html/button> "click me"`}
		</h3>,

	// fixme: fragments not working correctly with JSdom and Text nodes
	fragment1 : <DocumentFragment>
		Child 1
		<i>Child 2</i>
		{123345}
	</DocumentFragment>,

	fragment2 : <>
		Child 1
		<i>Child 2</i>
		{123345}
	</>,

	svg: 
		<svg 
			width="400"
			height="400">
			<circle
				cx={200}
				cy={200}
				r="100"
				fill="cyan"
				id="circle"/>
		</svg>
};