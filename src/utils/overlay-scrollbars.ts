import { querySelectorAll } from "../uix-dom/dom/shadow_dom_selector.ts";


/**
 * Enables overlay scrollbars with custom style on an HTML element (element must support shadow roots)
 * @param element 
 * @returns 
 */
export function enableOverlayScrollbars(element: HTMLDivElement) {

	if (element.shadowRoot) throw new Error("Cannot enable overlay scrollbars, element already has a shadow root")

	element.style.position = "relative"; // important

	const shadowRoot = element.attachShadow({mode: "closed"})
	const style = document.createElement("link")
	style.rel = "stylesheet"
	style.href = new URL('../style/base.css', import.meta.url).toString()
	shadowRoot.append(style)

	const slot = document.createElement("slot")
	const scrollbarX = createScrollbar("horizontal");
	const scrollbarY = createScrollbar("vertical");

	const scrollbarContainer = document.createElement("div")
	scrollbarContainer.classList.add("uix-scrollbar-container")
	scrollbarContainer.append(scrollbarX)
	scrollbarContainer.append(scrollbarY)

	shadowRoot.append(scrollbarContainer)
	shadowRoot.append(slot)

	addListeners(scrollbarContainer, element, scrollbarX, scrollbarY)

	element.style.scrollbarWidth = "none";

	return element;
}


let globalEnabled = false;

/**
 * Enables overlay scrollbars globally for all elements, also when added later
 */
export function enableOverlayScrollbarsGlobal() {
	// TODO
	if (globalEnabled) return;
	querySelectorAll("*").forEach(el => {
		if (globalThis.getComputedStyle(el)["overflow"] == "scroll")
			console.log("scrollbar element",el)
	})
}

export function disableOverlayScrollbarsGlobal() {
	globalEnabled = false;	
}


function createScrollbar(type: "vertical"|"horizontal") {
	const scrollbar = document.createElement("div");
	scrollbar.classList.add('uix-scrollbar', type == 'vertical' ? 'y' : 'x');
	return scrollbar
}

function addListeners(scrollbarContainer:HTMLElement, content: HTMLElement, scrollbar_x: HTMLElement, scrollbar_y: HTMLElement) {
	
	let scroll_x = true;
	let scroll_y = true;

	const updateScrollbars = ()=>{
		// y height
		let heightRatioY = content.offsetHeight / content.scrollHeight;
		if (heightRatioY > 0.99) heightRatioY = 1; // compensate pixel rounding errors
		else if (heightRatioY < 0.05) heightRatioY = 0.05; // not too small

		// y position
		const scrollRatioY = content.scrollTop / (content.scrollHeight-content.offsetHeight); 
		const topPercent = scrollRatioY * (1-heightRatioY);
		// remove overflow y position from height
		if (topPercent < 0) heightRatioY += topPercent;
		if (topPercent+heightRatioY > 1) heightRatioY = 1 - topPercent;

		scrollbar_y.style.top = Math.max(0, topPercent * 100) + "%"
		scrollbar_y.style.height = "calc(" + (heightRatioY * 100) + "% - 10px)"
		if (heightRatioY == 1) scrollbar_y.style.display = "none";
		else scrollbar_y.style.display = "block";


		// x width
		let heightRatioX = content.offsetWidth / content.scrollWidth;
		if (heightRatioX > 0.99) heightRatioX = 1; // compensate pixel rounding errors
		else if (heightRatioX < 0.05) heightRatioX = 0.05; // not too small

		// x position
		const scrollRatioX = content.scrollLeft / (content.scrollWidth-content.offsetWidth); 
		const leftPercent = scrollRatioX * (1-heightRatioX);
		// remove overflow x position from width
		if (leftPercent < 0) heightRatioX += leftPercent;
		if (leftPercent+heightRatioX > 1) heightRatioX = 1 - leftPercent;

		scrollbar_x.style.left = Math.max(0, leftPercent * 100) + "%"
		scrollbar_x.style.width = "calc(" + (heightRatioX * 100) + "% - 20px)"
		if (heightRatioX == 1) scrollbar_x.style.display = "none";
		else scrollbar_x.style.display = "block";
	}

	// scroll listener
	let ticking = false;

	content.addEventListener('scroll', function(e) {     
		scrollbarContainer.style.setProperty('--scrollY', content.scrollTop + 'px');
		scrollbarContainer.style.setProperty('--scrollX', content.scrollLeft + 'px');
     
		if (!ticking) {
		  globalThis.requestAnimationFrame(function() {
			updateScrollbars();
			ticking = false;
		  });
		  ticking = true;
		}
	});

	// scrollbar drag listeners
	let scrollingY:boolean;
	let scrollYStart:number;
	let scrollTopStart:number;

	let scrollingX:boolean;
	let scrollXStart:number;
	let scrollLeftStart:number;

	if (scroll_y) {
		scrollingY = false;
		scrollYStart = 0;
		scrollTopStart = 0;
		
		scrollbar_y.addEventListener("mousedown", function(e) {
			scrollbar_y.classList.add("active")
			scrollingY = true;
			scrollYStart = e.clientY;
			scrollTopStart = content.scrollTop;
		})
	}
   
	if (scroll_x) {
		scrollingX = false;
		scrollXStart = 0;
		scrollLeftStart = 0;

		scrollbar_x.addEventListener("mousedown", function(e) {
			scrollbar_x.classList.add("active")
			scrollingX = true;
			scrollXStart = e.clientX;
			scrollLeftStart = content.scrollLeft;
		})
	}
   

	globalThis.addEventListener("mousemove", (e) => {
		if (scrollingY) {
			e.preventDefault()
			e.stopPropagation()
			const delta = e.clientY - scrollYStart;
			const deltaPercent = delta / content.offsetHeight;
			const scrollYRatio = deltaPercent / (1-content.offsetHeight / content.scrollHeight);
			content.scrollTop = scrollTopStart + scrollYRatio * (content.scrollHeight-content.offsetHeight);
		}
		if (scrollingX) {
			e.preventDefault()
			e.stopPropagation()
			const delta = e.clientX - scrollXStart;
			const deltaPercent = delta / content.offsetWidth;
			const scrollXRatio = deltaPercent / (1-content.offsetWidth / content.scrollWidth);
			content.scrollLeft = scrollLeftStart + scrollXRatio * (content.scrollWidth-content.offsetWidth);
		}

	})

	// reset
	document.addEventListener("mouseup", function() {
		scrollingY = false;
		scrollingX = false;
		scrollbar_y.classList.remove("active")   
		scrollbar_x.classList.remove("active")
	})

	if (globalThis.ResizeObserver && !globalThis.Deno) {
		new ResizeObserver(updateScrollbars).observe(content);
	}
	
	content.addEventListener("mouseup", updateScrollbars)
	content.addEventListener("mousedown", updateScrollbars)

}




