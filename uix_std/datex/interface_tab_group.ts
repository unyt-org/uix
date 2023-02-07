// deno-lint-ignore-file no-namespace
import { Datex, text } from "unyt_core";
import { UIX } from "uix";

// Tab group with special (+) actions
@UIX.Group("Datex")
@UIX.Component<UIX.Components.TabGroup.Options>({}) 
@UIX.NoResources
export class InterfaceTabGroup extends UIX.Components.TabGroup {

    showDialog(body_text:string, on_add:(name:string)=>void){
        const body = UIX.Utils.createHTMLElement('<div style="display: flex;flex-direction: column;text-align: center;"></div>')
        const target = text("@");
        const input = new UIX.Elements.TextInput(target);
        input.style.textAlign = "center";
        input.style.fontFamily = "Menlo,Monaco,monospace";
        body.append(input)

        // input.on("input", ()=>{
        //     if ((<string>input.val()).startsWith("@")) input.style("color", "#29c73d")
        //     else if ((<string>input.val()).startsWith("*")) input.css("color", "#87c924")
        //     else if ((<string>input.val()).startsWith("#")) input.css("color", "#c2c729")
        //     else input.css("color", "inherit")
        // })
        

        body.insertAdjacentHTML('beforeend', "<p><span style='color:#777'>"+body_text+"</span></p>")
        const {cancel} = UIX.Actions.dialog("Add a new endpoint", body, [
            {text:"Cancel"},
            {text:"Add", color:"#29c73d", dark_text:true, onClick:()=>on_add(target.val)}
        ]);

        input.addEventListener("keydown", (e)=>{
            if (e.key == "Enter") {
                cancel();
                on_add(target.val);
            }
        })

        setTimeout(()=>{
            input.focus();
            target.val = "";
            target.val = "@";
        }, 20);
    }

    override createAddMenu(){
        return [{
            text: "New relayed connection",
            handler: ()=>{
                this.showDialog('Communication happens via<br> a relayed channel', (name)=>{
                    Datex.InterfaceManager.connect("relayed", <Datex.Endpoint>Datex.Target.get(name))
                });
            }
        }, {
            text: "New direct connection",
            handler: ()=>{
                this.showDialog('Communication happens via<br> a direct channel (WebRTC)', (name)=>{
                    Datex.InterfaceManager.connect("webrtc", <Datex.Endpoint>Datex.Target.get(name))
                });
            }
        }]
    }
}
