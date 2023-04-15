import { ValueInput } from "../uix/components/ValueInput.tsx";

/**
 * Put examples for all components in the testComponents object.
 * Every component can be displayed under the paths:
 *   /[key]/frontend
 *   /[key]/backend+static
 *   /[key]/backend+dynamic
 *   /[key]/backend+hydrated
 * 
 * (e.g. /textInput/frontend)
 */


export const testComponents = {
	textInput: <div>
		<ValueInput placeholder="... 1"/>
		<ValueInput placeholder="... 2"/>
	</div>
}