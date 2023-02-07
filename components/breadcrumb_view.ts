import { Component, NoResources } from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Actions } from "../base/actions.ts";

import { I } from "../uix_short.ts";
import { Types } from "../utils/global_types.ts";
import { UIX_APP } from "../base/app.ts";

// Page navigation:  Main > Sub > Sub 2

@Component<Base.Options>({
    padding:15, 
    border:false, 
    border_radius:0, 
    bg_color:null, 
    horizontal_align:Types.HORIZONTAL_ALIGN.LEFT, 
    vertical_align:Types.VERTICAL_ALIGN.TOP
})
@NoResources
export class BreadcrumbView<O extends Base.Options = Base.Options> extends Base<O> {

    main: HTMLHeadingElement;

    public override onCreate() {
        this.content.style.overflow = "visible";
        this.main = document.createElement("h3");
        this.main.style.margin = '0';
        this.main.style.padding = '2px';
        this.content.append(this.main)
        Actions.addPageNavUpdateListener((nav)=>{
            this.updateNav(nav);
        })
    }

    updateNav(nav:Types.nav_entry[]){
        this.main.innerHTML = "";
        for (let n=0; n<nav.length;n++) {
            let entry = nav[n];
            const el = document.createElement("span");
            if (entry.highlight) el.style.color = this.text_color_highlight;
            else el.style.color = this.text_color;
            el.innerText = entry.title;
            this.main.append(el);
            if (entry.onClick || entry.page) {
                el.classList.add('breadcrumb-link');
                el.addEventListener('click', ()=>{entry.onClick ? entry.onClick() :UIX_APP?.showPage(entry.page)});
            }
            if (n<nav.length-1) this.main.insertAdjacentHTML('beforeend', `<span style='color:${this.text_color_light};margin-left:5px;margin-right:5px'>${I('fa-chevron-right')}</span>`);
        }
    }

}
