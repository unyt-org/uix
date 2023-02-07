import { Component, NoResources, Abstract } from "../base/decorators.ts"
import { Types } from "../utils/global_types.ts";
import { ComponentProxy } from "./proxy.ts";

// placeholder for not loaded elements
@Component<ComponentProxy.Options>({
    title: "Element Invalid",
    title_color: '#faa',
    bg_color: "#4b1e2d",
    border_color: "#ef0058",
    border: true,
    icon: "fa-exclamation-circle",
    vertical_align: Types.VERTICAL_ALIGN.CENTER,
    horizontal_align: Types.HORIZONTAL_ALIGN.CENTER,
    fill_content:false,
    padding: 10
})
export class MissingElement<O extends ComponentProxy.Options = ComponentProxy.Options> extends ComponentProxy<O> {

    public override onCreate() {
        this.content.innerHTML = `<div class="default-text" style="text-align: center">Missing or invalid <br> implementation for<p><span style="color:#faa">${this.options.component?.constructor.name??"Unknown Element"}</span><br>(${"UNVERIFIED / TODO"})</p></div>`;
    }

}
