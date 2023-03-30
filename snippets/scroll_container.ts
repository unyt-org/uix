export type scrollContext = {scroll_x?:number, scroll_y?:number, scroll_to_bottom?:boolean, force_scroll_to_bottom?:boolean, element?:HTMLElement};


export function makeScrollContainer(element:HTMLElement, scroll_x = true, scroll_y = true, context:scrollContext = {scroll_x:0,scroll_y:0}) {

	const container = document.createElement("div");
	container.classList.add('uix-scrollbar-container')
	const content = document.createElement("div");
	content.classList.add('uix-scrollbar-content')

	content.append(element)
	container.append(content);

	const scrollbar_y = document.createElement("div");
	scrollbar_y.classList.add('uix-scrollbar', 'y');
	if (scroll_y) container.append(scrollbar_y)

	const scrollbar_x = document.createElement("div");
	scrollbar_x.classList.add('uix-scrollbar', 'x');
	if (scroll_x) container.append(scrollbar_x)

	enableScrollContainer(container, scroll_x, scroll_y, context);

	return container;
}


// takes element, returns scroll container element
export function enableScrollContainer(container:HTMLElement, scroll_x = true, scroll_y = true, context:scrollContext = {scroll_x:0,scroll_y:0}) {

	const content = context.element = <HTMLElement>container.querySelector('.uix-scrollbar-content');

	const scrollbar_y = <HTMLElement>container.querySelector('.uix-scrollbar.y');
	const scrollbar_x = <HTMLElement>container.querySelector('.uix-scrollbar.x');

	const element = <HTMLElement>content.firstChild;

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
	   
		context.scroll_y = content.scrollTop;
		context.scroll_x = content.scrollLeft;
	}

	// scroll listener
	let ticking = false;

	content.addEventListener('scroll', function(e) {          
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
			const delta = e.clientY - scrollYStart;
			const deltaPercent = delta / content.offsetHeight;
			const scrollYRatio = deltaPercent / (1-content.offsetHeight / content.scrollHeight);
			content.scrollTop = scrollTopStart + scrollYRatio * (content.scrollHeight-content.offsetHeight);
		}
		if (scrollingX) {
			const delta = e.clientX - scrollXStart;
			const deltaPercent = delta / content.offsetWidth;
			const scrollXRatio = deltaPercent / (1-content.offsetWidth / content.scrollWidth);
			content.scrollLeft = scrollLeftStart + scrollXRatio * (content.scrollWidth-content.offsetWidth);
		}
	})

	// reset
	document.addEventListener("mouseup", function(e) {
		scrollingY = false;
		scrollingX = false;
		scrollbar_y.classList.remove("active")   
		scrollbar_x.classList.remove("active")
	})

	let initial_scroll = ((context.scroll_y??0) > content.scrollHeight || (context.scroll_x??0) > content.scrollWidth);

	// if (!IS_HEADLESS) {
		// dom content resize observers
		new ResizeObserver(()=>{
			if (initial_scroll) {
				updateScrollPosition(context);
				setTimeout(()=>updateScrollPosition(context), 20);
				setTimeout(()=>{updateScrollPosition(context);initial_scroll = false;}, 100);
			}
			else updateScrollbars();
		}).observe(content);

		new ResizeObserver(()=>{
			updateScrollbars();
			// scroll to bottom
			if (context.scroll_to_bottom) scrollToBottom(context);
		}).observe(element);
	// }
	

	content.addEventListener("mouseup", ()=>updateScrollbars())
	content.addEventListener("mousedown", ()=>updateScrollbars())

	// move to saved scroll position
	updateScrollPosition(context)

	return container;
}


export function updateScrollPosition(context:scrollContext, x?:number, y?:number) {
	if (!context.element) return;

	if (x!=undefined) context.element.scrollLeft = context.scroll_x = x;
	else context.element.scrollLeft = context.scroll_x??0;

	if (y!=undefined) context.element.scrollTop = context.scroll_y = y;
	else context.element.scrollTop = context.scroll_y??0;
}

export function scrollToBottom(context:scrollContext, force_scroll = false){
	if (!context.element) return;	

	if (force_scroll || context.force_scroll_to_bottom || (context.element.scrollHeight - context.element.offsetHeight - context.element.scrollTop < 200))
		updateScrollPosition(context, undefined, context.element.scrollHeight-context.element.clientHeight)
}

export function scrollToTop(context:scrollContext){
	updateScrollPosition(context, undefined, 0)
}

