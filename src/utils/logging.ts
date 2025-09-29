import { ESCAPE_SEQUENCES } from "datex-core-legacy/datex_all.ts";
import { verboseArg } from "datex-core-legacy/utils/logger.ts";

export const CSI = '\u001b[';
export const CTRLSEQ = {
	FULL_CLEAR:		CSI + '3J' + CSI + 'H' + CSI + '2J',
	CLEAR_SCREEN:	CSI + '2J',
	HOME:			CSI + 'H',
	TOP_LEFT:		CSI + '1;1H',
} as const;

export enum StatusType {
	Loading = "loading",
	Running = "running",
	Warning = "warning",
	Error = "error",
};

const statusColors = {
	[StatusType.Loading]: ESCAPE_SEQUENCES.UNYT_BG_CYAN,
	[StatusType.Running]: ESCAPE_SEQUENCES.UNYT_BG_GREEN,
	[StatusType.Warning]: ESCAPE_SEQUENCES.UNYT_BG_YELLOW,
	[StatusType.Error]: ESCAPE_SEQUENCES.UNYT_BG_RED,
} as const;

const textColors = {
	[StatusType.Loading]: ESCAPE_SEQUENCES.BLACK,
	[StatusType.Running]: ESCAPE_SEQUENCES.BLACK,
	[StatusType.Warning]: ESCAPE_SEQUENCES.BLACK,
	[StatusType.Error]: ESCAPE_SEQUENCES.WHITE,
} as const;

const statusIcons = {
	[StatusType.Loading]: "🚀",
	[StatusType.Running]: "🌍",
	[StatusType.Warning]: "⚠️",
	[StatusType.Error]: "🚨"
};

const progressIcons = ["🕛", "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚"];

const textEncoder = new TextEncoder();

export class StatusBar {
	static #message = "";
	static #sideMessage = "";
	static #status: StatusType = StatusType.Loading;
	static #currentProgressIndex = -1;

	static set message(message: string) {
		this.#message = message;
		this.update();
	}

	static set sideMessage(message: string) {
		this.#currentProgressIndex++;
		if (this.#currentProgressIndex > progressIcons.length - 1) 
			this.#currentProgressIndex = 0;
		this.#sideMessage = message;
		this.update();
	}

	static set status(status: StatusType) {
		this.#status = status;
		this.update();
	}

	/** Clears the screen with respect for the status bar by moving the cursor to the third line afterwards */
	static clearScreen() {
		if (verboseArg) return; /* Do not clear the screen in verbose mode */
		Deno.stdout.writeSync(textEncoder.encode(CTRLSEQ.FULL_CLEAR));
		this.update();
		Deno.stdout.writeSync(textEncoder.encode(CSI + '2E'));
	}

	static update() {
		let output = "";

		// save cursor position
		output += CSI + 's';

		// move cursor to top left
		output += CTRLSEQ.TOP_LEFT;

		// status log with formatting
		output += `${statusColors[this.#status]}${ESCAPE_SEQUENCES.BOLD}${textColors[this.#status]} ${statusIcons[this.#status]} ${this.#message} ${CSI}K`;

		if (this.#sideMessage) {
			output += CSI + '9999G'; // move cursor to the end of the line
			output += CSI + (this.#sideMessage.length + 3) + "D"; // move cursor left
			output += `${this.#sideMessage} ${progressIcons[this.#currentProgressIndex]}`;
		}

		output += ESCAPE_SEQUENCES.RESET;

		// restore cursor position
		output += CSI + 'u';

		Deno.stdout.writeSync(textEncoder.encode(output));
	}
}