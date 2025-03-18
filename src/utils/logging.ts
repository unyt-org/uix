import { ESCAPE_SEQUENCES } from "datex-core-legacy/datex_all.ts";

export const CSI = '\u001b['
export const CTRLSEQ = {
	FULL_CLEAR:							CSI + '3J' + CSI + 'H' + CSI + '2J',
	CLEAR_SCREEN:						CSI + '2J',
	HOME:								CSI + 'H',
	TOP_LEFT:							CSI + '1;1H',
} as const;

const textEncoder = new TextEncoder();

export const STATUS_TYPE = {
	RELOADING: "RELOADING",
	RUNNING: "RUNNING",
	WARNING: "WARNING",
	ERROR: "ERROR",
} as const
export type STATUS_TYPE = typeof STATUS_TYPE[keyof typeof STATUS_TYPE];

const statusColors = {
	[STATUS_TYPE.RELOADING]: ESCAPE_SEQUENCES.UNYT_BG_CYAN,
	[STATUS_TYPE.RUNNING]: ESCAPE_SEQUENCES.UNYT_BG_GREEN,
	[STATUS_TYPE.WARNING]: ESCAPE_SEQUENCES.UNYT_BG_YELLOW,
	[STATUS_TYPE.ERROR]: ESCAPE_SEQUENCES.UNYT_BG_RED,
} as const;


export function printStatus(message: string, type: STATUS_TYPE, reset = true, restoreCursor = !reset) {
	if (!reset) {
		// save cursor position
		if (restoreCursor) Deno.stdout.write(textEncoder.encode(CSI + 's'));
	}
	Deno.stdout.write(textEncoder.encode(CTRLSEQ.TOP_LEFT));

	// log status to std with light blue background, white text
	Deno.stdout.write(textEncoder.encode(`${statusColors[type]}${ESCAPE_SEQUENCES.BOLD} ${message} ${ESCAPE_SEQUENCES.RESET}\n\n`));
	
	if (!reset) {
		// restore cursor position
		if (restoreCursor) Deno.stdout.write(textEncoder.encode(CSI + 'u'));
	}
	else {
		// put cursor back to start to allow overwriting
		Deno.stdout.write(textEncoder.encode(CTRLSEQ.TOP_LEFT));
	}
}


export function printReloadingStatus(message: string) {
	printStatus("🚀 " + message, STATUS_TYPE.RELOADING, true, false);
}

export function printRunningStatus(message: string) {
	printStatus("🚀 " + message, STATUS_TYPE.RUNNING, false, false);
}

export function updateRunningStatus(message: string) {
	printStatus("🌍 " + message, STATUS_TYPE.RUNNING, false, true);
}

export function updateWarningStatus(message: string) {
	printStatus("🌍  " + message, STATUS_TYPE.WARNING, false, true);
}