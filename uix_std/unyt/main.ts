/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Database - UIX Standard Lib                                                         ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  unyt-specific UIX Elements (login etc.)                                             ║
 ║  Visit https://docs.unyt.cc/unyt for more information                                ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
*/

// ---

import { Datex, f, text, boolean, not, and, md, transform } from "unyt_core"
import { DatexNFCAdapter } from "unyt_web/nfc_adapter.ts"
import {UIX, I} from "uix"

interface ELEMENT_WITH_MENU_OPTIONS extends UIX.Components.Base.Options {
    main_element: UIX.Components.Base,
    logo: string
}


// @scope @to('@+unyt:docs') class Todo {
//     @remote static LIST:Map<bigint, string> = undefined // undefined required currently for TS
// }

// @UIX.Id("TodoList")
// @UIX.Component<UIX.Components.List.Options>({title:"Todo List", icon:"fas-check-square", header:false})
// export class TodoList extends UIX.Components.List<UIX.Components.List.Options> {

//     override async onCreate(){
//         this.content.innerHTML = `<h1 style='margin:0 0 10px 0'>Todo List</h1>`

//         this.setColumnWidths(['30px', null])
//         this.setColumnBackgrounds([false, true])

//         let list = await Todo.LIST;

//         for (let [key, entry] of list) {
//             let content = entry.slice(6);
//             let checked = entry.startsWith("- [x]");

//             const update_entry = ()=>list.set(key, (checked?'- [x] ':'- [ ] ') + content);

//             // format content + listen for content changes
//             const content_div = UIX.Utils.createHTMLElement(`<div contenteditable spellcheck='false' style='cursor:text'>${UIX.Utils.escapeHtml(content).replace(/\n/g, '<br>')}</div>`);
//             content_div.addEventListener("input", ()=>{
//                 content = content_div.innerHTML;
//                 update_entry();
//             })

//             // add entry
//             this.addEntry({
//                 id: Number(key),
//                 title:`Todo Entry #${key}`,
//                 body: [
//                     // new UIX.Elements.Checkbox({checked, onChange:c=>{
//                     //     checked = c;
//                     //     update_entry();
//                     // }), 
//                     //content_div[0]
//                  ]
//             })

//         }
       
//     }

//     override onEntrySelected(entry:UIX.Components.List.list_view_entry) {
//     }

//     override onClear(){
//     }

// }


@UIX.Element
export class HeaderMenu extends UIX.Elements.Header {

    constructor(logo:Datex.CompatValue<string>, title:Datex.CompatValue<string>|Datex.CompatValue<HTMLElement>, login = true){

        // create menu elements
        const elements:UIX.Elements.Header.ElementData[] = [];
        if (logo) {
            const logo_el = UIX.Utils.createHTMLElement(`<img style="height:25px;margin-right:10px;margin-left: 25px;"/>`)
            UIX.Utils.setElementAttribute(logo_el, "src", logo)
            elements.push({element:logo_el, show_collapsed:false})
            
            // let logo_el_collapsed = UIX.Utils.createHTMLElement(`<img style="height:25px;margin-right:10px;margin-left: 5px;"/>`)
            // UIX.Utils.setElementAttribute(logo_el_collapsed, "src", logo)
            // elements.push({element:logo_el_collapsed, show_collapsed:true, show_expanded:false, align:'end'})
        }
        
        if (title) {
            const title_el = UIX.Utils.createHTMLElement(`<h1 style='margin:15px;margin-right:20px;margin-left:0px;font-size:20px;white-space:nowrap'></h1>`);
            if (!logo) title_el.style.marginLeft = "25px"; // add margin
            UIX.Utils.setElementHTML(title_el, title)
            elements.push({element:title_el, show_collapsed:false})
        } 
        
        const menu = UIX.Utils.createHTMLElement(`<div></div>`);
        UIX.Actions.addMenuBarEntriesUpdateListener((entries)=>{
            menu.innerHTML = "";
            for (const [name, context_menu] of Object.entries(entries||{})) {
                const entry = UIX.Utils.createHTMLElement(`<div class="tab-title small" style="margin-right:6px"><div style="position:relative; display: flex; align-items: center;">${name}</div></div>`);
                UIX.Handlers.contextMenu(entry, context_menu, undefined, undefined, ["mousedown"])
                menu.append(entry)
                
            }
        })
        elements.push({element:menu})

        if (login) {
            elements.push({element:new UserIconView({},{margin_right:25}), align:'end', show_collapsed:false})
            elements.push({element:new UserIconView({display:'small'},{margin_right:5}), align:'end', show_expanded:false})
        }


        super(elements)
    }
}

/** Element with menu on top */
@UIX.Component<ELEMENT_WITH_MENU_OPTIONS>({
    icon: 'fa-network-wired',
    padding:0,
    border_radius:0, 
    bg_color:'transparent',
    border:false,
    logo: "https://workbench.unyt.org/unyt_web/assets/logo_icon.svg",
    responsive: true,
    enable_routes: true
})
@UIX.NoResources
export class ElementWithMenu<O extends ELEMENT_WITH_MENU_OPTIONS = ELEMENT_WITH_MENU_OPTIONS> extends UIX.Components.Base<O> {

    public override onCreate(){
        this.style.backgroundSize = '1.5em 1.5em';

        this.header = new HeaderMenu(this.options.logo, this.options.title!);
        if (this.options.main_element) this.content.append(this.options.main_element)
    }
 
    override onLayoutModeNormal(){
        // this.content_container.style.background = "transparent"
        this.style.backgroundImage = 'linear-gradient(rgba(100, 100, 100, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(100, 100, 100, 0.1) 1px, transparent 1px)';
    }

    override onLayoutModePortrait(){
        // this.content_container.style.background = "transparent"
        this.style.backgroundImage = 'none';
    }

    override onRoute(identifier:string) {
        return this.options.main_element?.onRoute(identifier)
    }

    override getCurrentRoute() {
        return this.options.main_element?.getCurrentRoute()
    }
}


export interface LOGIN_VIEW_OPTIONS extends UIX.Components.Base.Options {
    type?: 'register'|'login',
    institution?:Datex.Institution
}


@UIX.Component<LOGIN_VIEW_OPTIONS>({
    icon: 'fa-user',
    enable_drop: false,
    bg_color: 'transparent',
    border:false,
    fill_content: false
}, {dynamic_size:true})
@UIX.NoResources
export class UserIconView<O extends LOGIN_VIEW_OPTIONS = LOGIN_VIEW_OPTIONS> extends UIX.Components.Base<O & {display?:'small'|'default'}> {

    override onCreate(){
        const container = document.createElement("div");
        container.style.display = "flex"
        container.style.alignItems = "center"

        if (this.options.display == 'small') {
            const endpoint_name = text(Datex.Runtime.endpoint.toString());
            Datex.Runtime.onEndpointChanged((e)=>endpoint_name.val = e.toString())
            const endpoint = new UIX.Elements.Text(endpoint_name);
            
            container.append(endpoint);
        }
       
        if (this.options.display == 'small') container.append(UIX.Utils.createHTMLElement("<div style='display:flex;justify-content:center;align-items:center;cursor:pointer;height:40px;aspect-ratio:1;border-radius:50%;text-align:center;line-height:42px;font-size:1.2em;line-height:2em;color:var(--text_highlight)'>"+I('fas-fingerprint')+"</div>"));
        else container.append(UIX.Utils.createHTMLElement("<div style='margin-left:5px;display:flex;justify-content:center;align-items:center;cursor:pointer;height:40px;aspect-ratio:1;border-radius:50%;background:#eeeeee36;text-align:center;line-height:42px;font-size:1.4em;line-height:2em;color:var(--text_highlight)'>"+I('fas-fingerprint')+"</div>"));
        
        this.content.append(container);

        this.addEventListener("click", ()=>{
            const view = new LoginView({type:'login'});
            UIX.Actions.elementDialog(view, true, undefined, UIX.Actions.DialogSize.DYNAMIC);
        })
    }

}


export interface AUTH_VIEW_OPTIONS extends UIX.Components.Base.Options {
    type?: 'register'|'login',
    institution?:Datex.Institution
}
@UIX.Component<AUTH_VIEW_OPTIONS>({
    icon: 'fa-user',
    enable_drop: false,
    fill_content: false,
    padding: 20,
    bg_color: UIX.Theme.getColorReference('bg_default')
})
@UIX.NoResources
export class AuthView<O extends AUTH_VIEW_OPTIONS = AUTH_VIEW_OPTIONS> extends UIX.Components.Base<O> {
    private main!:HTMLDivElement;

    override onCreate(){
        this.content.append(UIX.Utils.createHTMLElement('<div style="font-size:25px;margin-bottom:20px;display:flex;justify-content:center;align-items:center">'+I('fas-fingerprint')+'<span style="margin-left:5px">unyt<span style="color:var(--green)">auth</span></span></div>'))
        this.main = document.createElement("div");
        this.main.style.display = "flex";
        this.main.style.flexDirection = "column";
        this.main.style.alignItems = "center";
        this.content.style.display = "flex";
        this.content.style.flexDirection = "column";
        this.content.append(this.main);

        this.showRegister();
    }

    private showRegister() {

        const userString = <Datex.TextRef<Datex.endpoint_name>>text();
        const password = text();
        const mail = text();
        const tos = boolean();
        const user = <Datex.Value<Datex.Endpoint>> transform([userString], v => ((v?.length>1||(v?.length&&!v.startsWith('@'))) ? f(<Datex.endpoint_name>(v.startsWith('@') ? v : '@'+v)):Datex.BROADCAST));


        /**
         * ----------------------------------------------------------
         * nur so als idee wie man das mit den transforms nochmal um einiges verkürzen kann :)
         */

        const passwordValid = transform([password], (password) => password.length >= 6);
        const userValid     = transform([user],     (user) => user.name?.length >= 4 && user!=Datex.BROADCAST);
        const mailValid     = transform([mail],     (mail) => !!mail!.match( /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/));

        const passwordDisplayValid  = transform([passwordValid, password], (passwordValid, password) => passwordValid || !password.length)
        const userDisplayValid      = transform([userValid, user],         (userValid, user) => userValid || user == Datex.BROADCAST)
        const mailDisplayValid      = transform([mailValid, mail],         (mailValid, mail) => mailValid || !mail.length)

        const inputValid = and(passwordValid, userValid, mailValid, tos);

        
        this.main.append(
            new UIX.Elements.TextInput(userString, {
                placeholder: "Identifier", 
                valid: userDisplayValid
            }).css({
                'margin-bottom':'5px'
            }),

            new UIX.Elements.EMailInput(mail, {
                placeholder: "E-Mail", 
                valid: mailDisplayValid
            }).css({
                'margin-bottom':'5px'
            }),
            
            new UIX.Elements.ContainerValueInput(password, {
                type: "password",
                placeholder: "Password", 
                valid: passwordDisplayValid
            }).css({
                'margin-bottom':'5px'
            }),

            new UIX.Elements.Checkbox({
                label: md('I agree to the [TOS](https://unyt.org/tos)'), 
                checked: tos
            }).css({
                'margin-bottom':'15px'
            }),

            new UIX.Elements.Button({
                text: 'Register', 
                color: 'var(--green)', 
                text_color: 'black', 
                disabled: not(inputValid), 
                onClick: async ()=>{
                    const isValid = await Datex.Unyt.registerAccount(user.val, mail.val, password.val);
                    console.info("Registration is valid: %s!", isValid);
                }
            }).css({
                'width': '100%'
            })
        )
    }

}


@UIX.Component<LOGIN_VIEW_OPTIONS>({
    icon: 'fa-user',
    enable_drop: false,
    fill_content: false,
    padding: 20,
    bg_color: UIX.Theme.getColorReference('bg_default')
})
@UIX.NoResources
export class LoginView<O extends LOGIN_VIEW_OPTIONS = LOGIN_VIEW_OPTIONS> extends UIX.Components.Base<O> {

    main!:HTMLDivElement

    override onCreate(){
        this.content.append(UIX.Utils.createHTMLElement('<div style="font-size:25px;margin-bottom:20px;display:flex;justify-content:center;align-items:center">'+I('fas-fingerprint')+'<span style="margin-left:5px">unyt<span style="color:var(--green)">auth</span></span></div>'))
        this.main = document.createElement("div");
        this.main.style.display = "flex";
        this.main.style.flexDirection = "column";
        this.content.append(this.main);
        this.showLogin();

    }

    private showLogin() {
        const userString = <Datex.TextRef<Datex.endpoint_name>>text("");
        const password = text("");
        const user = <Datex.Value<Datex.Endpoint>> transform([userString], v=>(v?.length>1||(v?.length&&!v.startsWith('@'))) ? f(<Datex.endpoint_name>(v.startsWith('@') ? v : '@'+v)):Datex.BROADCAST);

        const user_input = new UIX.Elements.TextInput(userString, {placeholder:"Identifier"});
        const password_input = new UIX.Elements.PasswordInput(password, {placeholder:"Password"});
        user_input.style.marginBottom = "5px";
        password_input.style.marginBottom = "15px";

        const login_btn = new UIX.Elements.Button({text:"Login", color:'var(--green)', text_color:'black', onClick: async ()=>{
            const valid = await Datex.Unyt.login(user.val, password.val);
            console.log("valid", valid)
            if (!valid) {
                user_input.invalid = true;
                password_input.invalid = true;
            }
            else this.remove();
        }}).css("width", "100%")

        let scan_btn:UIX.Elements.Button|undefined;
        if (DatexNFCAdapter.supported && !DatexNFCAdapter.supports_background_scanning) {
            scan_btn = new UIX.Elements.Button({text:"Scan Authenticator", color:'var(--light_blue)', text_color:'black', onClick: ()=>{
                DatexNFCAdapter.listen()
            }}).css("width", "100%")
            scan_btn.style.marginTop = "5px";
        }
        
        this.content.style.display = "flex";
        this.content.style.flexDirection = "column";

        this.main.append(user_input)
        this.main.append(password_input)
        this.main.append(login_btn)

        if (scan_btn) this.main.append(scan_btn)

    }

}

@UIX.Component<UIX.Components.Base.Options>({
    icon: 'fa-user',
    enable_drop: false,
    fill_content: false,
    border: false,
    border_radius: 0,
    bg_color: UIX.Theme.getColorReference('green')
})
@UIX.NoResources
export class LoginSuccessView extends UIX.Components.Base<UIX.Components.Base.Options & {endpoint:Datex.Endpoint}> {

    protected override onCreate(): void | Promise<void> {
        this.content.appendChild(new UIX.Elements.Text(`Hello, ${this.options.endpoint}!`, {text_color:'black', text_size:'2em'}).css('font-weight', 'bold'))
    }

}


// add endpoint handler
DatexNFCAdapter.addNewNFCEndpointListener(async (nfc_endpoint)=>{

    const endpoint = nfc_endpoint.endpoint;
    const password = await nfc_endpoint.getPassword();

    console.log("endpoint name: " + endpoint);
    console.log("endpoint password: " + password);

    nfc_endpoint.disconnect();

    // let valid = await Datex.Unyt.login(endpoint, password)
    // console.log("login data valid: " + valid);

    const view = new LoginSuccessView({endpoint:nfc_endpoint.endpoint});
    const {cancel} = UIX.Actions.elementDialog(view, false, undefined, UIX.Actions.DialogSize.FULLSCREEN)
    view.addEventListener("click", cancel);
})

// background scanning
if (DatexNFCAdapter.supports_background_scanning) DatexNFCAdapter.listen();
