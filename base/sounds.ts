import { logger } from "../utils/global_values.ts";

// Sounds
export namespace Sounds {

	// predefined sound snippets
	export const ALERT = "alert.m4a";
	export const DELETE = "delete.m4a";
	export const DROP = "drop.m4a";
	export const ERROR_1 = "error_1.m4a";
	export const ERROR_2 = "error_2.m4a";
	export const ERROR_3 = "error_3.m4a";
	export const RINGTONE = "ringtone.mp3"
	
	let required_sound_files = [
		//ALERT /*,DELETE*/, DROP, ERROR_1, ERROR_2, ERROR_3, RINGTONE
	]

	let audios = {}
	let initialised = false

	export function init(){
		for (let name of required_sound_files) {
			audios[name] = new Audio("/audio/" + name); // TODO:UIX_URL
		}
		initialised = true;
	}


	export async function play(snippet:string): Promise<boolean> {
		if (!audios[snippet]) {
			return false
		}
		try {
			await audios[snippet].play();
		} catch (e) {
			logger.error("Cannot play sound");
			return false;
		}
		return true;
	}

	export function stop(snippet:string): boolean {
		if (!audios[snippet]) {
			return false
		}
		audios[snippet].currentTime = 0;
		audios[snippet].pause();
		return true;
	}
}

Sounds.init()