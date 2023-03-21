import {UIX, S} from "uix";

@Component export class UIXEditor extends UIX.Components.Base {
	
    @content headerBar = <div>-</div>
    @property target = <UIX.Components.MissingElement/>;
    @content mainContainer = <div>
        <div id="contentContainer">
            <div class="resizeBar right"></div>
            <div class="resizeBar bottom"></div>
            <div id="contentBox">
                {this.target}
            </div>
        </div>
    </div>

    override onCreate() {
        const contentContainer = this.content.querySelector("#contentContainer")!;
        const contentBox = this.content.querySelector("#contentBox")!;
        contentBox.addEventListener("mouseout", (e)=>{
            contentContainer.classList.add("showUI")
        })
        contentBox.addEventListener("mouseover", (e)=>{
            contentContainer.classList.remove("showUI")
        })

        contentBox.addEventListener('mousemove', e => {
            const els = this.getElementHierarchyAtPoint(e.clientX, e.clientY);
            console.log(els)
            if (els.at(-1) instanceof Element && els.at(-1) != contentBox && els.at(-1) != contentContainer && els.at(-1) != this.mainContainer) this.#setActiveHoverElement(els.at(-1)!)
        }, {passive: true})
    }

    #activeHoverElement?: Element;

    #setActiveHoverElement(element: Element) {
        if (this.#activeHoverElement) {
            this.#activeHoverElement.classList.remove("edit-hover")
            this.#activeHoverElement.removeAttribute("contenteditable")
        }
        this.#activeHoverElement = element
        this.#activeHoverElement.classList.add("edit-hover")
        this.#activeHoverElement.setAttribute("contenteditable", "true")
        this.headerBar.innerText = this.getElementLabel(this.#activeHoverElement)
    }

    private getElementHierarchyAtPoint(x:number, y:number, _parent:Document|ShadowRoot = document, _hiearchy:Element[] = []): Element[] {
        const el = _parent.elementFromPoint(x, y);
        if (el) _hiearchy.push(el);
        if (el?.shadowRoot) return this.getElementHierarchyAtPoint(x,y, el.shadowRoot, _hiearchy)
        else return _hiearchy;
    }

    private getElementLabel(element: Element) {
        return element.tagName.toLowerCase() + (element.id?`#${element.id}` : '');
    }
}