/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  File Editors - UIX Standard Lib                                                     ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  some default file editors, including audio, image and pdf viewers / editors         ║
 ║  Visit https://docs.unyt.cc/uix for more information                                 ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---
import {UIX} from "../../uix.ts";

@UIX.Group("Files")
@UIX.BindFiles({
    file_extensions: ["jpg", "jpeg", "png", "svg", "gif", "webp", "tiff", "ico"],
    default_icon: 'fa-file-image'
})
@UIX.Component
export class ImageFileEditor extends UIX.Components.FileEditor {

    protected createEditContextMenu() {
        return {
            get_image: {
                text: "Get Image URL"
            }
        }
    }

    // @override
    public async loadFile(path) {
        let valid = await super.loadFile(path);
        if (!valid) return false;

        this.content.style.margin = "0"
        this.content.style.height = "100%";
        this.content.style.width = "100%";

        // TODO raw image sources?? url raw.code.unyt.cc?
        let url = await this.resource.object_url;
        this.content.innerHTML = `<div class="edit-image" style="width:calc(100% - 20px);height:calc(100% - 20px);display:flex;justify-content:center;padding: 10px"><img draggable="false" style="object-fit: contain;border-radius:1vmin;image-rendering: pixelated;image-rendering: -moz-crisp-edges;max-width:100%;max-height:100%" src="${url}" alt="Image Preview"></div>`;

        let img = this.content.querySelector("img");

        let scale = 1;
        let start_x = 0, start_y = 0;
        let d_x = 0, d_y = 0;
        let moving = false;

        let updateTransform = ()=>{
            img.style.transform = 'scale(' + scale + ') translate('+(d_x/scale)+'px, '+(d_y/scale)+'px)';
        }

        img.addEventListener("dragstart", function() {
            return false;
        });

        this.content.addEventListener("wheel", e => {
            let delta = -e.deltaY / 250;
            scale *= 1 + delta
            if (scale < 0.05) scale = 0.05;
            else if (scale > 20) scale = 20;

            updateTransform();
            e.preventDefault();
        });

        this.content.addEventListener("mousedown", e => {
            moving = true;
            start_x = e.clientX - d_x;
            start_y = e.clientY - d_y;
        })

        this.content.addEventListener("mouseup", e =>  moving = false)
        this.content.addEventListener("mouseleave", e => moving = false)

        this.content.addEventListener("mousemove", e => {
            if (!moving) return;
            d_x = e.clientX - start_x;
            d_y = e.clientY - start_y;

            updateTransform();
        })

        return true;
    }

    protected async saveFile(): Promise<any> {
        return null
    }

}

@UIX.Group("Files")
@UIX.BindFiles({
    file_extensions: ["m4a", "mp3", "wav", "ogg"],
    default_icon: 'fa-file-audio'
})
@UIX.Component({
    fill_content:false
})
export class AudioFileEditor extends UIX.Components.FileEditor {

    createEditContextMenu() {
        return {}
    }

    // @override
    public async loadFile(path) {
        let valid = await super.loadFile(path);
        if (!valid) return false;

        let url = await this.resource.object_url;
        this.content.innerHTML = `<div style="display:flex;justify-content:center;"><audio controls src="${url}" ></div>`;

        return true;
    }

    protected async saveFile(): Promise<any> {
        return null
    }

}

@UIX.Group("Files")
@UIX.BindFiles({
    file_extensions: ["pdf"],
    default_icon: 'fa-file-pdf'
})
@UIX.Component()
export class PdfFileEditor extends UIX.Components.FileEditor {
    
    protect_content_area = true // prevent redirecting mouseover events to iframe while resizing

    createEditContextMenu() {return {}}

    // @override
    async loadFile(path) {
        let valid = await super.loadFile(path);
        if (!valid) return false;

        // TODO raw image sources?? url raw.code.unyt.cc?
        let url = await this.resource.object_url;
        this.content.innerHTML = `<iframe style="width: 100%; height: 100%; border: none" src='${url}'></iframe>`;

        return true;
    }

    async saveFile(): Promise<any> {
        return null
    }

}
