import { Datex } from "unyt_core";
import { logger } from "../utils/global_values.ts";

export const std_lib_files = {

    "menubar":"unyt",
    "loginview":"unyt",
    "elementwithmenu":"unyt",
    "todolist":"unyt",

    "codeeditor":"code_editor",
    "markdownviewer":"code_editor",

    "consoleview":"console",

    "sshterminal":"terminal",
    "terminal":"terminal",

    "dbview":"database",
    "dbtableview":"database",
    "dbqueryview":"database",
    "dbextendedtableview":"database",
    "dbtree":"database",
    "dbstructureview":"database",

    "imagefileeditor":"file_editors",
    "audiofileeditor":"file_editors",
    "pdffileeditor":"file_editors",
    "nodeeditor":"node_editor",

    "filetreeview":"files",

    "unytcallview":"unytcall",

    "datexdebugger":"datex",
    "datexconsoleview":"datex",
    "interfacetabgroup":"datex",
    "datexinterface":"datex",
    "datexeditor":"datex",
    "datexvaluetreeview":"datex",
    "datexpointerlist":"datex",
    "datexstaticscopelist":"datex",
    "dxbviewer":"datex",
    "dxbviewerconsole":"datex",
    "dxbviewerinfo":"datex",
    "datexstorageviewer":"datex",
    "datexstoragesectionviewer":"datex",

    "usbdevicelist": "external_devices",
    "bluetoothdevicelist": "external_devices",
    "externaldevicemanager": "external_devices",

    "charts": ["Chart",  "DonutChart"],
};



Datex.typeConfigurationLoader(["uix","uixopt"], async (type)=>{
	if (std_lib_files[type.name]) { // file found where the class exists
		try {
			await import(new URL("../uix_std/"+std_lib_files[type.name]+"/main.ts", import.meta.url).toString());
			logger.debug("uix: loaded type " + type);
			return true;
		}
		catch (e) {
			logger.error("uix: error loading type" + type, e);
			return false;
		}
	}
	else return false;
})


