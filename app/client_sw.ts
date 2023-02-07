// register service worker
import "./client_default.ts";
import {UIX} from "uix";

// ignore SafFarI for now
if (!(navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1)) {
	await UIX.ServiceWorker.register("/_uix_sw.js");
}