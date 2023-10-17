import { HTTPStatus } from "./http-status.ts";

export class HTTPError extends Error {
	public statusCode: number;
	
	constructor(statusCode: number|HTTPStatus = 500, message?: string) {
		if (message == undefined) {
			const statusDefaultContent = (statusCode instanceof HTTPStatus ? 
				statusCode : 
				HTTPStatus.get(statusCode))?.content;
			if (typeof statusDefaultContent == "string") message = statusDefaultContent  
		}
			
		super(message)
		this.statusCode = typeof statusCode == "number" ? statusCode : statusCode.code;
	}
}