import { logger } from "datex-core-legacy/datex_all.ts";
import { app } from "../app/app.ts";
import { unsafeHTML } from "../../uix-short.ts";
import { HTTPError } from "./http-error.ts";
import { HTTPStatus } from "./http-status.ts";
import { bindToOrigin } from "../app/datex-over-http.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { domUtils } from "../app/dom-context.ts";

function createErrorMessageHTML(title: string, message?: string|Element, attachment?: Element, statusCode?: number, displayLocation?: string) {

	return <div style="width:100%; height:100vh; background-color:#282828; display:flex; justify-content:center; align-items:center">
		
		<div style="display:grid; padding:20px; margin: 15px; color: #ef7b7b; background-color:#4e3635; border-radius:10px; width: fit-content;max-width: 100%; max-height: 100%; overflow: scroll; ">
			<div style="display:flex">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-x-circle-fill" viewBox="0 0 16 16">
					<path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM5.354 4.646a.5.5 0 1 0-.708.708L7.293 8l-2.647 2.646a.5.5 0 0 0 .708.708L8 8.707l2.646 2.647a.5.5 0 0 0 .708-.708L8.707 8l2.647-2.646a.5.5 0 0 0-.708-.708L8 7.293 5.354 4.646z"/>
				</svg>
				<pre style="margin: 0; margin-left: 7px; text-wrap: wrap;">
					<div style="display:flex;justify-content: space-between;margin-bottom: 5px">
						<b style="color:#ef7b7b; margin-bottom: 7px; display: contents;">{statusCode?statusCode + ' ' : ''}{title}</b>
						{displayLocation ? <div style="background: #776565; color: #4e3635; border-radius: 6px; display: flex; justify-content: center; align-items: center; padding: 0px 8px;margin-left: 15px;">{displayLocation}</div> : undefined}
					</div>
					{message}
				</pre>
			</div>
			{attachment}
		</div>
	</div> as HTMLDivElement
}

const matchURL = /\b((https?|file):\/\/[^\s]+(\:\d+)?(\:\d+)?\b)/g;

export function createErrorHTML(title: string, error?: Error|number|HTTPStatus<number,string>|string) {
	const isExplicitStatusCode = error instanceof HTTPError || error instanceof HTTPStatus || typeof error == "number";
	const isBackend = client_type=="deno";
	const displayLocation = isBackend ? "Backend" : "Frontend"

	let errorMessage:string|Element|undefined = error instanceof HTTPStatus ? error.content?.toString() : (typeof error == "string" ? error : undefined);
	let attachment = undefined

	error ??= HTTPStatus.INTERNAL_SERVER_ERROR;

	// just use error message as title if HTTPError
	if (error instanceof HTTPError) {
		title = error.message
	}

	// extract status code
	const statusCode = error instanceof HTTPError ? 
		error.statusCode : (
			error instanceof HTTPStatus ?
			error.code : (
				(error instanceof Error || typeof error == "string") ? 
					HTTPStatus.INTERNAL_SERVER_ERROR.code : 
					error
			)
		);

	if (error instanceof Error) {
		const stackMessage = error.stack ?? error.message ?? "";
		const lastURL = stackMessage.match(matchURL)?.[0];
		const stack = domUtils.escapeHtml(stackMessage).replace(matchURL, '<a target="_blank" style="color:#a4c1f3" href="$&'+(isBackend ? ':source': '')+'">$&</a>')
		errorMessage = unsafeHTML(`<div>${stack}</div>`);
		attachment = lastURL ? 
			<iframe onload={bindToOrigin(e => e.target.style.display="block")} style="height: 250px;margin-top: 30px;width: 100%;border:none; border-radius:8px" src={lastURL+(isBackend ? ':source': '')}></iframe> :
			undefined;
	}


	const isProduction = app.stage !== "dev";

	return [
		statusCode,
		isProduction ? 
			productionErrorGenerator(
				title,
				errorMessage,
				attachment,
				isExplicitStatusCode ? statusCode : undefined,
				displayLocation
			) :
			createErrorMessageHTML(
				title,
				errorMessage,
				attachment,
				isExplicitStatusCode ? statusCode : undefined,
				displayLocation
			)
	] as const
}

/**
 * Display an error message in a browser window - display a modified error with different (less) information in non-dev stage
 * @param title 
 * @param error
 * @returns 
 */
export function displayError(title: string, error?: Error|number|HTTPStatus<number,string>|string) {
	// display if browser
	if (client_type === "browser") {
		const [_status, html] = createErrorHTML(title, error);
		document.body.innerHTML = "";
		document.body.append(html);
	}
	logger.error(title + '\n' + (error ? error.toString() : ''))
}

type errorGenerator = (title: string, message?: string|Element, attachment?: Element, statusCode?: number, displayLocation?: string) => Element;

// default impl for prod mode generator: always omit message + attachment in prod mode
let productionErrorGenerator:errorGenerator = (title, message, attachment, statusCode, displayLocation) => {
	return createErrorMessageHTML(title, undefined, undefined, statusCode)
};


/**
 * Define a generator function that generates errors for in production mode
 * @param generator callback that gets error information as input and returns a new Element
 */
export function setProductionErrorGenerator(generator: errorGenerator) {
	productionErrorGenerator = generator;
}

