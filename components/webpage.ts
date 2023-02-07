import { Component, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";

export namespace Webpage {
    export interface Options extends Base.Options {
        url?: string, // http(s) url
    }
}

@Component({icon:'fa-globe-americas', fill_content:true})
@NoResources
export class Webpage<O extends Webpage.Options = Webpage.Options> extends Base<O> {

    override protect_content_area = true // prevent redirecting mouseover events to iframe while resizing

    declare content:HTMLIFrameElement

    override hasValidOptions(){
        return !!this.options.url
    }

    override requiredOptionsList(){
        return {
            url: {type:"string", name:"URL"}
        }
    }
    

    protected getLocation(href) {
        var location = document.createElement("a");
        location.href = href;
        if (location.host == "") {
            location.href = location.href;
        }
        return location;
    }

    override onCreate() {
        this.content.addEventListener('load', e => {
            this.title = "<i class='fa fa-globe-americas'></i> " + this.content.contentDocument?.title;
        });
        this.content.innerHTML = `<iframe allowtransparency="true" style="width: 100%; height: 100%; border: none" src='${this.options.url||"https://unyt.org"}'></iframe>`;
        this.title = this.getLocation(this.options.url).hostname;
    }

}
