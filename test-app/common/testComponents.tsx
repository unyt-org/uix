import { ValueInput } from "uix/components/ValueInput.tsx";

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
	</div>
}