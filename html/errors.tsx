import { client_type, logger } from "unyt_core/datex_all.ts";
import { app } from "../app/app.ts";
import { Datex } from "unyt_core/datex.ts";

export function createErrorMessageHTML(title: Datex.RefOrValue<string>, message?: Datex.RefOrValue<string>|Element, attachment?: Element) {
	return <div style="width:100%; height:100%; background-color:#282828; display:flex; justify-content:center; align-items:center">
		
		<div style="display:grid; padding:20px; margin: 15px; color: #ef7b7b; background-color:#4e3635; border-radius:10px; width: fit-content;max-width: 100%; max-height: 100%; overflow: scroll; ">
			<div style="display:flex">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
					<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
				</svg>
				<pre style="margin: 0; margin-left: 7px; text-wrap: wrap;">
					<b style="color:#ef7b7b; margin-bottom: 7px; display: block;">{title}</b>
					{message}
				</pre>
			</div>
			{attachment}
		</div>
	</div> as HTMLDivElement
}

const defaultProductionError = {
	title: "Sorry - something went wrong",
	message: "Please contact the owner of this website if this happens again"
} as {
	title?: Datex.RefOrValue<string>
	message?: Datex.RefOrValue<string>
}

/**
 * Display an error message in a browser window - falls back to the default production error if not running in dev stage
 * @param title 
 * @param message 
 * @param attachment 
 * @returns 
 */
export function displayError(title: Datex.RefOrValue<string>, message?: Datex.RefOrValue<string>|Element, attachment?: Element) {
	// override if not in dev stage
	if (app.stage !== "dev") {
		title = defaultProductionError.title??title;
		message = defaultProductionError.message;
	}
	// display if browser
	if (client_type === "browser") {
		const html = createErrorMessageHTML(title, message, attachment);
		document.body.innerHTML = "";
		document.body.append(html);
	}
	logger.error(title + '\n' + (typeof message == "string" ? message : ""))
}

/**
 * Set an error that is displayed when displayError is called in production mode
 * @param title 
 * @param message 
 */
export function setDefaultProductionError(title: Datex.RefOrValue<string>, message?: Datex.RefOrValue<string>|Element) {
	defaultProductionError.title = title;
	defaultProductionError.message = message;
}

