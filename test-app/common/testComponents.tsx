import { TextInput } from "../uix/components/TextInput.tsx";

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

const div = <div></div> as HTMLButtonElement;

export const testComponents = {
	textInput: <TextInput/>
}