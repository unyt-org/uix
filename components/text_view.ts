// deno-lint-ignore-file no-namespace
import { Component, NoResources} from "../base/decorators.ts"
import { Base } from "./base.ts";
import { Elements } from "../elements/main.ts";
import { Datex } from "unyt_core";


export namespace TextView {
    export interface Options extends Base.Options {
        text:Datex.CompatValue<string|Datex.Markdown>,
        text_size?:Datex.CompatValue<string>,
        editable?:Datex.CompatValue<boolean>,
        new_lines?:Datex.CompatValue<boolean>,
        markdown?:Datex.CompatValue<boolean>,
    }
}

// simple example class for extending Component
@Component<TextView.Options>({
    text: "Hello World =)",
    fill_content: false,
    icon: 'fas-align-left'
})
@NoResources
export class TextView<O extends TextView.Options = TextView.Options> extends Base<O> {

    public override onCreate() {
        this.content.append(new Elements.Text(<Datex.CompatValue<string|Datex.Markdown>> this.options.$.text, {markdown:this.options.markdown, text_size:this.options.text_size, editable:this.options.editable, new_lines:this.options.new_lines}));
    }

}
