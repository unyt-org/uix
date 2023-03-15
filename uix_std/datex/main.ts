// deno-lint-ignore-file require-await
/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Database - UIX Standard Lib                                                         ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  datex tools                                                                         ║
 ║  Visit https://docs.unyt.cc/unyt for more information                                ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---

import { UIX } from "uix";

import { Logger } from "unyt_core/utils/logger.ts";
import MonacoHandler from "uix_std/code_editor/monaco.ts";
import {Datex} from "unyt_core/datex.ts";
import { DatexPointerList, DatexValueTreeView } from "./value_tree_view.ts";
import { DatexInterface } from "./interface.ts";
import { DatexDataViewer } from "./data_viewer.ts";
import { DatexStorageViewer } from "./storage_viewer.ts";
import { dx_value_manager } from "./resource_manager.ts";

// load monaco
await MonacoHandler.init(); 
// enable colored markdown code
Datex.Markdown.setCodeColorizer(MonacoHandler.monaco.editor.colorize)


UIX.Utils.registerEntryType("datex_pointer_root", "#eeeeee", "");
UIX.Utils.registerEntryType("datex_value", "#bbb", "");
UIX.Utils.registerEntryType("datex_top_level_pointer", "#bbb", "");

UIX.Res.addStrings({
    en: {
        no_dxb: 'No DXB available',
        no_interface: 'Interface not available',
        run: 'Run',
        v2: 'Compiler V2',
        copy_value: "Copy Value",
        copy_pointer_id: "Copy Pointer ID",
        delete_pointer: "Delete Pointer",
        add_endpoint: "Add Endpoint",
        clear_history: "Clear history",
        clear_storage: "Clear storage",
        download: "Save File",
        download_short: "Save",
        open_file: "Open File",
        new_file: "New",
        test: "Test",

        copy_decompiled_datex: "Copy Decompiled DATEX",

        menu_file: "File",
        menu_entry_export_dxb: "Export as .dxb",
        menu_entry_export_dx: "Export as .dx",
        menu_entry_import_dxb: "Import .dxb",
        menu_entry_import_dx: "Import .dx",
        menu_entry_import_json: "Import .json",

    },
    de: {
        no_dxb: 'Kein DXB verfügbar',
        no_interface: 'Interface nicht verfügbar',
        run: 'Ausführen',
        v2: 'Compiler V2',
        copy_value: "Wert kopieren",
        copy_pointer_id: "Pointer-ID kopieren",
        delete_pointer: "Pointer löschen",
        add_endpoint: "Endpoint hinzufügen",
        clear_history: "Verlauf löschen",
        clear_storage: "Speicher löschen",
        download: "Datei speichern",
        download_short: "Speichern",
        open_file: "Datei öffnen",
        new_file: "Neu",
        test: "Testen",

        copy_decompiled_datex: "Dekompilerten DATEX-Code kopieren",

        menu_file: "Datei",
        menu_entry_export_dxb: "Als .dxb exportieren",
        menu_entry_export_dx: "Als .dx exportieren",
        menu_entry_import_dxb: ".dxb importieren",
        menu_entry_import_dx: ".dx importieren",
        menu_entry_import_json: ".json importieren",

    }
})

UIX.Res.addShortcut("datex_debug", "ctrl+d")
UIX.Res.addShortcut("datex_pointers", "ctrl+p")
UIX.Res.addShortcut("datex_data_flow", "ctrl+f")
UIX.Res.addShortcut("datex_cache", "ctrl+k")
UIX.Res.addShortcut("f4", "f4")

UIX.Res.addShortcut("copy_value", {macos:"cmd+v", windows:"ctrl+v"})

// debugging shortcuts
UIX.Handlers.handleShortcut(globalThis.window, "datex_debug", ()=>{
    const dx_debugger = new DatexInterface({local_interface:true, removable:false, temporary:true, bg_color:undefined});
    UIX.Actions.elementDialog(dx_debugger, true, undefined, UIX.Actions.DialogSize.LARGE);
    // const dx_debugger = new DatexDebugger();
    // document.body.append(dx_debugger);
});
UIX.Handlers.handleShortcut(globalThis.window, "datex_pointers", ()=>{
    const dx_pointers = new DatexPointerList({removable:false, temporary:true, bg_color:UIX.Theme.getColorReference("bg_default")});
    UIX.Actions.elementDialog(dx_pointers, true, undefined, UIX.Actions.DialogSize.LARGE);
});
UIX.Handlers.handleShortcut(globalThis.window, "datex_data_flow", ()=>{
    const dx_data_flow = new DatexDataViewer({removable:false, temporary:true, bg_color:undefined});
    UIX.Actions.elementDialog(dx_data_flow, true, undefined, UIX.Actions.DialogSize.LARGE);
});
UIX.Handlers.handleShortcut(globalThis.window, "datex_cache", ()=>{
    const dx_storage = new DatexStorageViewer({removable:false, temporary:true, bg_color:undefined});
    UIX.Actions.elementDialog(dx_storage, true, undefined, UIX.Actions.DialogSize.LARGE);
});


export async function inspect(value:any) {
    const tree_view = new DatexValueTreeView({
        root_resource_path:(await dx_value_manager.getResourceForValue(value)).path,
        header:false, enable_drop:false,
        display_root: true
    }, {dynamic_size:false});

    UIX.Actions.elementDialog(tree_view, true, undefined, UIX.Actions.DialogSize.DEFAULT)
}

globalThis.inspect = inspect;


export * from "./console_view.ts";
export * from "./data_flow_viewer.ts";
export * from "./data_viewer.ts";
export * from "./db_viewer_info.ts";
export * from "./debugger.ts";
export * from "./dxb_viewer_console.ts";
export * from "./dxb_viewer.ts";
export * from "./editor.ts";
export * from "./interface_tab_group.ts";
export * from "./interface.ts";
export * from "./resource_manager.ts";
export * from "./runtime_info.ts";
export * from "./storage_section_viewer.ts";
export * from "./storage_viewer.ts"
export * from "./value_tree_view.ts"