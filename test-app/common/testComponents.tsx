import { ValueInput } from "uix/components/ValueInput.tsx";
import { UIX } from "uix/uix.ts";
import { Api, test } from "../backend/public.ts";

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


export const testComponents = {

	textInput: <div style={{display:"flex", gap:5, margin:5}}>
		<ValueInput placeholder="text 1..."/>
	</div>,

	/** 
	 * Contexts demo:
	 * 
	 * Per default, event listeners are always called in the *original context*
	 * -> When the button is created on the backend and displayed in standalone mode 
	 *    on the frontend, the onclick handler is still called on the *backend*
	 * -> When the button is created and rendered on the frontend, the onclick
	 *    handler is called on the *frontend*
	 * 
 	 * By wrapping it with UIX.onFrontend(), the onmousedown handler is always called on
	 * the *frontend*, also in standalone mode
	*/
	contexts: 
		<button 
			onmousedown={UIX.onFrontend(() => console.log("mouse down"))} 
			onmouseup={Api.method1}
			onclick={e => {
				console.log("clicked",e);
				const x = test(10);
				console.log("res",x)
			}}
		>
			Click Me
		</button>
}