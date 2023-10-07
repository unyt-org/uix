// register service worker
import { ServiceWorker } from "uix/sw/sw-installer.ts";
import "./default.ts";

// ignore SafFarI for now
if (!(navigator.userAgent.indexOf('Safari') != -1 && navigator.userAgent.indexOf('Chrome') == -1)) {
	await ServiceWorker.register("/@uix/sw.js");
}