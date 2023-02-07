import { Component, NoResources } from "../base/decorators.ts"
import { Webpage } from "./webpage.ts";

@Component({icon:'fa-globe-americas'})
@NoResources
export class WebPortal<O extends Webpage.Options = Webpage.Options> extends Webpage<O> {

    portal;

    override onCreate() {
        this.content.addEventListener('load', e => {
            this.title = "<i class='fa fa-globe-americas'></i> " + this.content.contentDocument?.title;
        });

        this.portal = document.createElement('portal');
        this.portal.src = this.options.url
        this.portal.style.width = "100%";
        this.portal.style.height = "100%";

        this.content.append(this.portal);
        this.title = this.getLocation(this.options.url).hostname;
    }

    activate(){
        this.portal.activate();
    }

}
