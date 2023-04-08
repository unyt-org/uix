import {UIX, I, S} from "uix";

@Component export class UIXEditor extends UIX.Components.Base {
	

    @content headerBar = <div>-</div>
    @property target = 
        <div id="example">
            <h1>Title</h1>
            {"Some Description text here"}
            <UIX.Components.TextView text="Edit me"/>
        </div>
    @id contentBox = <div id="contentBox">
        {this.target}
    </div>;
    @content mainContainer = <div>
        <div id="contentContainer">
            <div class="resizeBar right"></div>
            <div class="resizeBar bottom"></div>
            {this.contentBox}
        </div>
    </div>

    @content leftMenu = <div></div>
    @content rightMenu = <div></div>

    override onDisplay() {
        const contentContainer = this.content.querySelector("#contentContainer")!;
        this.contentBox.addEventListener("mouseout", (e)=>{
            contentContainer.classList.add("showUI");
            this.#setActiveHoverElement(null);
        })
        this.contentBox.addEventListener("mouseover", (e)=>{
            contentContainer.classList.remove("showUI")
        })

        this.contentBox.addEventListener('mousemove', (e) => {
            const els = this.getElementHierarchyAtPoint(e.clientX, e.clientY);
            if (els.at(-1) instanceof Element && els.at(-1) != this.contentBox && els.at(-1) != contentContainer && els.at(-1) != this.mainContainer) this.#setActiveHoverElement(els.at(-1)!)
        }, {passive: true})

        this.addResizeListener(this.mainContainer.querySelector(".resizeBar.right")!, 'x')
        this.addResizeListener(this.mainContainer.querySelector(".resizeBar.bottom")!, 'y')
    }

    addResizeListener(bar:HTMLElement, dir: 'x'|'y') {
        let start = 0;
        let moving = false;
        let startSize = 0;
        bar.addEventListener("mousedown", (e)=>{
            start = dir=='x' ? e.clientX : e.clientY;
            startSize = this.contentBox.getBoundingClientRect()[dir=='x' ? 'width' : 'height'];
            moving = true;
            e.preventDefault();
        })
        globalThis.addEventListener("mouseup", (e)=>{
            moving = false;
        })
        globalThis.addEventListener("mousemove", (e)=>{
            if (!moving) return;
            const pos = dir=='x' ? e.clientX : e.clientY;
            const delta = pos -start;
            const newSize = delta*2 + startSize;

            if (newSize < 50) return;
            if (dir == 'x' && newSize < this.mainContainer.getBoundingClientRect().width - 200)
                this.contentBox.style.width = `${newSize}px`
            else if (newSize < this.mainContainer.getBoundingClientRect().height - 200) 
                this.contentBox.style.height = `${newSize}px`
        })
    }

    #activeHoverElement?: Element|null;

    #setActiveHoverElement(element: Element|null) {
        if (this.#activeHoverElement == element) return;

        if (this.#activeHoverElement) {
            this.#activeHoverElement.classList.remove("edit-hover")
            this.#activeHoverElement.removeAttribute("contenteditable")
        }
        this.#activeHoverElement = element
        this.#activeHoverElement?.classList.add("edit-hover")
        this.#activeHoverElement?.setAttribute("contenteditable", "true")
        this.headerBar.innerText = this.#activeHoverElement ? this.getElementLabel(this.#activeHoverElement) : "-";
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


    protected override createContextMenu() {
        return {
            auto_size: {
                text: "Auto Size", 
                shortcut: "copy",
                icon: I`fas-maximize`,
                handler: ()=>this.toggleContentSize()
            }
        }
    }

    protected toggleContentSize() {
        if (this.contentBox.classList.contains("autoSize")) this.contentBox.classList.remove("autoSize")
        else this.contentBox.classList.add("autoSize")
    }

    protected setContentSizeAuto(auto: boolean) {
        if (auto) this.contentBox.classList.add("autoSize")
        else this.contentBox.classList.remove("autoSize")
    }


}