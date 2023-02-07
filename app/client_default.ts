/**
 * Default client side UIX app implentation
 * Requests app from provider endpoint
 */
import {Datex} from "unyt_core";
await Datex.Supranet.connect();

// UIX.State.saved(async ()=>{
// 	const state = <UIX.Components.Base>await get('@example')
// 	console.log("state",state);
// 	return state;
// })