/**
 * Represents an error that the UIX developer community knows about.
 * The user might be able to fix it or ask for help.
 */
export class KnownError extends Error {
	solutions: string[];
	constructor(message: string, ...solutions: string[]) {
		super(message);
		this.solutions = solutions;
	}
}