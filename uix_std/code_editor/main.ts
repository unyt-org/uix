/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  CodeEditor and MarkdownViewer - UIX Standard Lib                                    ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  code editor based on the Monaco Editor (https://microsoft.github.io/monaco-editor/) ║
 ║  Visit https://docs.unyt.cc/uix for more information                                 ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */


// ---

import MonacoHandler, {MonacoTab} from "./monaco.ts";
import {UIX} from "../../uix.ts";
import "./marked.js";
declare let marked;

import { Logger } from "unyt_core/utils/logger.ts";
import { S } from "../../uix_short.ts";
import { Resource } from "../../uix_all.ts";
const logger = new Logger("code_editor")


@UIX.BindFiles({
    file_extensions: ["txt", "sh", "h", "swift", "sql", "mts", "mjs", "md", "yml", "tofu", "conf" , "template", "dx", "dxb"],
    default_icon: 'fa-file-invoice',
    file_extensions_with_options: {
        "htm":  {icon: 'fa-file-code', color:'#77d7e8'},
        "html": {icon: 'fa-file-code', color:'#77d7e8'},

        "ts":   {icon: 'uix-file-ts', color:'#a37dc1'},
        "js":   {icon: 'uix-file-js', color:'#deba8f'},
        "css":  {icon: 'uix-file-css'},
        "scss": {icon: 'uix-file-scss'},
        "jsx":  {icon: 'uix-file-jsx', color:'#deba8f'},
        "tsx":  {icon: 'uix-file-tsx', color:'#a37dc1'},
        "json": {icon: 'uix-file-json', color:'#8e8ad5'},
        "java": {icon: 'uix-file-java'},
        "py":   {icon: 'uix-file-py'},
        "php":  {icon: 'uix-file-php'},
        "cpp":  {icon: 'uix-file-cpp'},
        "kt":   {icon: 'uix-file-kt'},
        "c":   {icon: 'uix-file-c'},

        "txt":  {icon: 'fa-file-alt'},
    }
})
@UIX.Component
export class CodeEditor<O extends UIX.Components.FileEditor.Options = UIX.Components.FileEditor.Options> extends UIX.Components.FileEditor<O> {

    private monaco: MonacoTab

    createEditContextMenu() { return {
        rename_symbol: {
            text: S('rename_symbol'),
            shortcut: "rename_symbol",
            handler: ()=>this.monaco.triggerAction("rename"),
        },
        change_all_occ: {
            text: S('change_all_occ'),
            shortcut: "change_all_occ",
            handler: ()=>this.monaco.triggerAction("changeAll"),
        },
        command_palette: {
            text: S('command_palette'),
            shortcut: "command_palette",
            handler: ()=>this.monaco.triggerAction("quickCommand"),
        }
    }}


    // @override
    // TODO dont reload file but update monaco model!!!
    public async loadFile(path_or_resource: string|Resource) {
        let valid = await super.loadFile(path_or_resource);
        if (!valid) return false;

        // this.html.css("margin-top", "15px");
        // this.html.css("margin-bottom", "10px");
        this.content.style.height = "100%";

        if (!this.monaco) this.monaco = await MonacoHandler.createTab(this.content, this, this.options.editable);

        valid = await this.monaco.setFile(this.resource);
        if (!valid) return false;

        this.updateScrollPosition();

        this.monaco.addDirtyListener((is_dirty)=>{
            if (is_dirty) this.addFlag("dirty")
            else this.removeFlag("dirty")
        })

        this.monaco.addErrorListener((error)=>{
            if (error) this.addFlag("error")
            else this.removeFlag("error")
        })

        this.monaco.setScrollListener( (x,y)=>{
            this.options._scroll_x = x
            this.options._scroll_y = y
        })


        return true;
    }

    // @override
    public updateScrollPosition(x?:number, y?:number) {
        if (x!=null) this.options._scroll_x = x;
        if (y!=null) this.options._scroll_y = y;
        this.monaco?.setScroll(this.options._scroll_x, this.options._scroll_y);
    }

    // @override
    public focusContent (){
        this.monaco?.focus();
    }
    
    protected async saveFile(): Promise<any> {
        await this.monaco?.saveFile()
    }

    onInit() {
        this.addStyleSheet(MonacoHandler.stylesheet);
        super.onInit();
    }

   

}
// deno-lint-ignore no-namespace
export namespace MarkdownViewer {
    export interface Options extends UIX.Components.FileEditor.Options {
        h1_color?: string // color for h1 elements
        hx_color?: string // color for other h elements
        a_color?: string // color for a elements,
        table_bg?: string
        table_header_bg?: string
    }
}


@UIX.BindFiles({file_extensions_with_options: {"md": {icon: 'fa-book'}}})
@UIX.Component({icon:"fa-book", vertical_align:UIX.Types.VERTICAL_ALIGN.TOP, horizontal_align:UIX.Types.HORIZONTAL_ALIGN.LEFT})
export class MarkdownViewer extends UIX.Components.Base<MarkdownViewer.Options> {

    resource: Resource


    override async onCreate() {

        // workaround to pre-load editor style
        await MonacoHandler.init();
        this.addStyleSheet(MonacoHandler.standalone_stylesheet);

        if (this.options.path) {
            this.resource = Resource.get(this.options.path);
    
            this.resource.listenForUpdates(async ()=>{
                console.log("update markdown file " + this.resource.name)
                this.renderMarkdown(new TextDecoder().decode(await this.resource.value));
            })

            await this.renderMarkdown(new TextDecoder().decode(await this.resource.value))
        }

        else if (this.options.url) {
            await this.renderMarkdown(await (await fetch(this.options.url, {credentials: 'include'})).text())
        }

    }

    protected renderMarkdown(content:string){
        const id = UIX.Utils.getUniqueElementId();

        let style = `<style>
            #${id} r { color: var(--red) }
            #${id} g { color: var(--green) }
            #${id} bl { color: var(--blue) }
            #${id} o { color: var(--orange) }
            #${id} pu { color: var(--purple) }
            #${id} y { color: var(--yellow) }
            #${id} l { color: var(--light_blue) }
            #${id} bg_r, #${id} bg_bl, #${id} bg_o, #${id} bg_pu, #${id} bg_y, #${id} bg_l, #${id} info {
                border-radius: 8px;
                padding: 0px 2px;
                margin: 2px 0px;
                display: inline-block;}
            #${id} bg_r {background: var(--red);}
            #${id} bg_bl {background: var(--blue);}
            #${id} bg_o {background: var(--orange);}
            #${id} bg_pu {background: var(--purple);}
            #${id} bg_y {background: var(--yellow);}
            #${id} bg_l {background: var(--light_blue);}
            #${id} info {background: #444488cc;padding:10px;margin-right:50px;margin-left:50px;border:1px solid ${UIX.Theme.collapseColorToCss(this.options.$.h1_color)}}
            `
            
        if (this.options.h1_color) {
            style += `#${id} h1, #${id} strong, #${id} b { color:${UIX.Theme.collapseColorToCss(this.options.$.h1_color)}}\n`
        }
        if (this.options.hx_color) {
            style += `#${id} h2, #${id} h3, #${id} h4, #${id} h5, #${id} h6 { color:${UIX.Theme.collapseColorToCss(this.options.$.hx_color)}}\n`
        }
        if (this.options.a_color) {
            style += `#${id} a { color:${UIX.Theme.collapseColorToCss(this.options.$.a_color)}}\n`
        }
        if (this.options.table_bg) {
            style += `#${id} td, #${id} table { background:${UIX.Theme.collapseColorToCss(this.options.$.table_bg)}}\n`
        }
        if (this.options.table_header_bg) {
            style += `#${id} th { background:${UIX.Theme.collapseColorToCss(this.options.$.table_header_bg)}}\n`
        }
            
        style += '</style>\n'    

        content = style + content;

        const container = UIX.HTMLUtils.createHTMLElement(`<div class='docs-code' id='${id}' style='font-size: 17px;max-width:1200px;user-select:text;padding:20px;padding-top:35px;padding-left:30px;padding-right:30px;width: calc(100% - 60px)'></div>`)
        
        if (!content) {
            content = ""
        }
        try {
            container.innerHTML = marked(content);

            this.title = container.querySelector("h1")?.innerText

    
            // format code  
            let current_lang; // current inline lang
            container.querySelectorAll("code").forEach(async c=>{
                let text = c.innerText;
                // inline language?
                let _inline_lang = text.match(/^([a-zA-Z0-9_-]+)!/);
                let _attr_lang = c.getAttribute("class")?.replace("language-", "");
                // code block language?
                if (_inline_lang) {
                    current_lang = _inline_lang[1];
                    text = text.substring(_inline_lang[0].length)
                }
                if (_attr_lang) {
                    current_lang = _attr_lang;
                }
                if (current_lang) {
                    c.innerHTML = this.formatCode(await MonacoHandler.colorize(text, current_lang));
                    c.setAttribute("lang", current_lang)
                }          
            })


            container.querySelectorAll("img").forEach(async i=> {
                // change src to internal resource
                let src:string = i.getAttribute("src");
                let resource = await this.resource?.parent.getChild(src);
                if (resource) i.setAttribute("src", await resource.object_url)
            })

        } catch (e) {
            logger.error("MD error", e)
            setTimeout(()=>this.remove(),0); // remove with timeout 0, onShow must first return!
        }

        let scroll_x = this.options._scroll_x,
            scroll_y = this.options._scroll_y;

        container.style.visibility = "hidden";

        // assign current scroll state to this container and keep track of the scrolling position
        this.content.innerHTML = "";
        this.content.append(this.makeScrollContainer(container));

        return new Promise<void>(resolve=>{
            setTimeout(()=>{
                this.updateScrollPosition(scroll_x,scroll_y);
                container.style.visibility = "visible";
                resolve();
            }, 0);
        })
        
    }

    formatCode(code:string): string {
        return code
            .replace(/<span class="(\w+)">(\/){4}(&nbsp;| | )*/g, '<span class="$1">') // //// comments
            //.replace(/<span class="(\w+)">(@)<\/span><span class="((\w+ *)*)">(\w*)/g, '<span><span style="color:var(--blue)">$2$5') // @decorators
    }

}