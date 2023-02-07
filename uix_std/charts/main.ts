/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  Charts - UIX Standard Lib                                                           ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  chart elements                                                                      ║
 ║  Visit https://docs.unyt.cc/uix for more information                                 ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---

import { Datex, pointer, props } from "unyt_core";
import {UIX} from "uix"

const svgns = "http://www.w3.org/2000/svg";


export function numberValueToChartXYData(value:Datex.CompatValue<number|bigint>, options?:{}): chart_xy_entry[] {
    const data:chart_xy_entry[] = pointer([]);

    function newDataPoint(value:number|bigint){
        data.push([{value:data.length}, {value:value}])
    }

    if (value instanceof Datex.Value) value.observe((v)=>{
        newDataPoint(<any>v);
    })

    newDataPoint(value instanceof Datex.Value ? value.val : value);

    return data;
}


export type chart_xy_entry = [{label?:string,value?:bigint|number}, {value:bigint|number}]

interface chart_entry_format {
    color?:Datex.CompatValue<string>,
}

interface chart_xy_entry_format extends chart_entry_format{
    line_width?:number
}


export interface CHART_OPTIONS<F extends chart_entry_format = chart_entry_format, E = any> extends UIX.Components.Base.Options {
    show_labels?:boolean,
    data:{[label:string]:E},
    format?:{[label:string]:F},
}

export interface CHART_XY_OPTIONS extends CHART_OPTIONS<chart_xy_entry_format, chart_xy_entry[]> {
    fill?: boolean,
    gradient?:boolean,
    show_grid?:boolean
}


export interface PIE_CHART_OPTIONS extends CHART_OPTIONS<chart_entry_format, number|Datex.Quantity|bigint> {
    round?:boolean,
    relative_values?:boolean
}



@UIX.Component({
    responsive: true,
})
@UIX.NoResources
@UIX.Abstract
export abstract class Chart<O extends CHART_OPTIONS> extends UIX.Components.Base<O> {

    svg!:SVGElement
    
    svgWidth:number = 0
    svgHeight:number = 0

    get svgCenterX() {return (this.svgWidth / 2) || 0}
    get svgCenterY() {return (this.svgHeight / 2) || 0}

    #labels:Set<string> = new Set()

    get labels() {
        return this.#labels;
    }


    get data(){
        return this.options.data instanceof Datex.Value ? this.options.data.val : this.options.data;
    }

    set data(data: Datex.CompatValue<any>){

        this.options.data = data;

        // observe DatexValue
        const dx_value = Datex.Pointer.pointerifyValue(data);
        
        if (dx_value instanceof Datex.Value) {
            dx_value.observe((v, k, p)=>{
                // new data point
                if (p && !this.labels.has(k)) this.observeDataPoint(k);
            });
        }

        for (let l of Object.keys(data)) this.observeDataPoint(l);

    }

    private observeDataPoint(label:string) {
        const data = this.options.$.data.$[label];
        this.labels.add(label);

        if (data instanceof Datex.Value) {
            data.observe((v,k,p)=>{
                if (!p) {
                    if (this.labels.has(label)) this.onDataPointUpdated(label, this.options.$.data.$[label]);
                    else this.onNewDataPoint(label, this.options.$.data.$[label]);
                }
            })
        }

        this.onNewDataPoint(label, data);
    }

    protected override onInit(): void {
        this.svg = document.createElementNS(svgns, "svg");
        this.svg.style.display = "block";
        this.svg.style.fontSize = "16px";
        this.content.append(this.svg);
    }

    protected override onCreate() {
        if (!this.options.data) return;

        this.data = this.options.data;
        
        this.updateDimensions();
    }

    public override onResize(){
        this.triggerChartResize();
    }

    // call to trigger all resize updates
    public triggerChartResize(){
        this.updateDimensions();
        this.handleChartResize()
    }


    public getLabelFormat(label: string, key:keyof chart_entry_format, default_value:any) {
        return this.options.format?.[label]?.[key] ?? default_value;
    }

    // animation
    protected handleAnimation(callback:(t:number)=>boolean|void, speed = 20) {
        let t = 0;
        const animate = () => {
            const lastT = t;
            const cancel = callback(t);
            t += 1 / speed;
            if (t<1 && !cancel) requestAnimationFrame(()=>animate());
            // last t, make sure it is 1
            else if (lastT != 1) callback(1);
        }
        animate();
    }

    protected interpolate(start:number, end:number, t:number){
        return start + t*(end-start);
    }



    updateDimensions(){
        this.svgWidth = this.content.getBoundingClientRect().width;
        this.svgHeight = this.content.getBoundingClientRect().height;

        this.svg.setAttribute("viewBox", "0 0 " + this.svgWidth + " " + this.svgHeight);
        this.svg.setAttribute("width", this.svgWidth.toString());
        this.svg.setAttribute("height", this.svgHeight.toString());
    }

    protected abstract onNewDataPoint(label:string, data:any):void
    protected abstract onDataPointUpdated(label:string, data:any):void
    protected abstract handleChartResize():void

}


@UIX.Component<PIE_CHART_OPTIONS>({
    round: true
})
@UIX.NoResources
export class PieChart<O extends PIE_CHART_OPTIONS> extends Chart<O> {

    
    outerCircle!:SVGCircleElement
    maskPath!:SVGMaskElement
    maskCircle!:SVGCircleElement

    sectionGroup!:SVGGElement

    sections: Map<string,[SVGGElement,SVGCircleElement,SVGCircleElement|undefined,SVGCircleElement|undefined]> = new Map()

    sectionValues: Map<string,number> = new Map()

    get diameter() {return Math.min(this.svgWidth, this.svgHeight) * 0.9}
    get inner_diameter() {return this.diameter / 2}

    override onCreate() {

        this.outerCircle = document.createElementNS(svgns, "circle");
        this.outerCircle.style.fill = 'var(--bg_dark)';
        this.svg.append(this.outerCircle);

        this.maskPath = document.createElementNS(svgns, "mask");
        this.maskPath.id = UIX.Utils.getUniqueElementId();
        const maskRect = document.createElementNS(svgns, "rect");
        maskRect.setAttribute("width", "100%");
        maskRect.setAttribute("height", "100%");
        maskRect.style.fill = "white";
        this.maskPath.append(maskRect);
        this.maskCircle = document.createElementNS(svgns, "circle");
        this.maskCircle.style.fill = "black";
        this.maskPath.append(this.maskCircle);

        
        this.sectionGroup = document.createElementNS(svgns, "g");
        this.sectionGroup.style.mask = `url(#${this.maskPath.id})`;

        // workaround: required for inner circle mask to work as expected?!!
        const fillRect = document.createElementNS(svgns, "rect");
        fillRect.setAttribute("width", "100%");
        fillRect.setAttribute("height", "100%");
        fillRect.style.fill = "transparent";
        this.sectionGroup.append(fillRect)

        this.svg.append(this.sectionGroup);


        this.svg.append(this.maskPath);

        super.onCreate();
    }

    protected onNewDataPoint(label: string, data: any) {

        const color = this.getLabelFormat(label, 'color', UIX.Theme.getColorReference('light_blue'));

        const section = document.createElementNS(svgns, "g");

        const mainCircle = document.createElementNS(svgns, "circle");
        mainCircle.style.stroke = color;
        mainCircle.style.fill = "transparent";
        section.append(mainCircle);

        let startCircle:SVGCircleElement|undefined, endCircle:SVGCircleElement|undefined;
        if (this.options.round) {
            startCircle = document.createElementNS(svgns, "circle");
            startCircle.style.fill = color;
            section.append(startCircle);
    
            endCircle = document.createElementNS(svgns, "circle");
            endCircle.style.fill = color;
            section.append(endCircle);
        }

        this.sectionGroup.append(section);

        this.sectionValues.set(label, 0);
        this.sections.set(label, [section, mainCircle, startCircle, endCircle]);
        this.updateSection(label);
        this.onDataPointUpdated(label,data);
    }

    protected onDataPointUpdated(label: string, data: any) {

        const startValue = this.sectionValues.get(label);
        const endValue = this.options.data[label];

        this.handleAnimation((t=>{
            this.sectionValues.set(label, this.interpolate(startValue??0, (endValue instanceof Datex.Quantity ? endValue.value : Number(endValue)) ?? 0, t));
            this.updateSectionLength(label)
        }))
    }


    protected handleChartResize(): void {
        this.outerCircle.setAttribute("cx", this.svgCenterX.toString());
        this.outerCircle.setAttribute("cy", this.svgCenterY.toString());
        this.outerCircle.setAttribute("r", (this.diameter/2).toString());

        this.maskCircle.setAttribute("cx", this.svgCenterX.toString());
        this.maskCircle.setAttribute("cy", this.svgCenterY.toString());
        this.maskCircle.setAttribute("r", (this.inner_diameter/2).toString());

        this.maskPath.setAttribute("width", this.svgWidth.toString());
        this.maskPath.setAttribute("height", this.svgHeight.toString());

        for (let label of this.labels) {
            this.updateSection(label);
        }
    }

    protected updateSection(label:string){
        if (!this.sections.has(label)) throw new Error("Pie Chart section with label '" + label + "' does not exist");
        const [section, mainCircle, startCircle, endCircle] = this.sections.get(label)!;

        const padding = 0.1;
        const diameter = this.diameter * (1-padding);

        mainCircle.setAttribute("cx", this.svgCenterX.toString());
        mainCircle.setAttribute("cy", this.svgCenterY.toString());
        mainCircle.setAttribute("r", (diameter/4).toString());
        mainCircle.style.strokeWidth = (diameter/2).toString();


        if (this.options.round && startCircle && endCircle) {
            const small_diameter = diameter - this.inner_diameter;
            startCircle.setAttribute("r", (small_diameter/4).toString())
            startCircle.setAttribute("cx", ( this.svgCenterX + (diameter/2 - small_diameter/4) ).toString());
            startCircle.setAttribute("cy", this.svgCenterY.toString());
    
            endCircle.setAttribute("r", (small_diameter/4).toString())
        }
     

        this.updateSectionLength(label);
    }

    // don't update overall dimensions, only new section length
    protected updateSectionLength(label:string, recursive = true) {
        if (!this.sections.has(label)) throw new Error("Pie Chart section with label '" + label + "' does not exist");
        const [section, mainCircle, startCircle, endCircle] = this.sections.get(label)!;

        const padding = 0.1;
        const diameter = this.diameter * (1-padding);
        const radius = diameter / 2; 
        const fraction = this.getSectionValue(label);
        const piR = (Math.PI*diameter/2);

        if (this.options.round && endCircle) {
            const small_diameter = diameter - this.inner_diameter;
            endCircle.setAttribute("cx", ( this.svgCenterX + (radius-small_diameter/4) * Math.cos(fraction*(2*Math.PI)) ).toString());
            endCircle.setAttribute("cy", ( this.svgCenterY + (radius-small_diameter/4) * Math.sin(fraction*(2*Math.PI)) ).toString());
        }
       
        mainCircle.style.strokeDasharray = fraction*piR + " " +piR;

        // update length + rotation for all
        if (this.options.relative_values && recursive) {
            for (let l of this.labels) this.updateSectionLength(l,false);
        }
        // only update rotation for all
        else {
            for (let l of this.labels) this.updateSectionRotation(l);
        }
       
    }

    // only update rotation for section
    protected updateSectionRotation(label:string) {
        const [section,] = this.sections.get(label);

        const rotation = -90 + (this.getSectionRotation(label) * 360);
        section.setAttribute("transform", "rotate("+rotation+", "+this.svgCenterX+", "+this.svgCenterY+")");
    }


    // get length of a section (percentage)
    protected getSectionValue(label: string) {
        if (this.options.relative_values) return (this.sectionValues.get(label) / this.getCumulativeValue()) || 0;
        else return this.sectionValues.get(label)
    }

    protected getCumulativeValue() {
        let sum = 0;
        for (let label of this.labels) {
            sum += this.sectionValues.get(label) || 0;
        }
        return sum;
    }

    // get rotation offset of a section (percentage)
    protected getSectionRotation(label: string) {
        let rotation = 0;
        for (let other_label of this.labels) {
            if (other_label == label) break;
            rotation += this.getSectionValue(other_label);
        }
        return rotation;
    }

    // utils

    private polarToCartesian(centerX:number, centerY:number, radius:number, angleInDegrees:number) {
        const angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
      
        return {
          x: centerX + (radius * Math.cos(angleInRadians)),
          y: centerY + (radius * Math.sin(angleInRadians))
        };
    }
      
    private updateArc(path:SVGPathElement, x:number, y:number, radius:number, startAngle:number, endAngle:number){
      
        const start = this.polarToCartesian(x, y, radius, endAngle);
        const end = this.polarToCartesian(x, y, radius, startAngle);

        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

        const d = [
            "M", start.x, start.y, 
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");

        path.setAttribute("d", d)
    }


}


@UIX.Component<CHART_XY_OPTIONS>({
    fill: true,
    gradient: true,
    show_labels: true,
    show_grid: true
})
@UIX.NoResources
@UIX.Abstract
export abstract class ChartXY<O extends CHART_XY_OPTIONS> extends Chart<O> {

    // graph coordinates, not svg box coordinates:
    minX = 0;
    minY = 0;

    maxX = 20;
    maxY = 20;

    get graphWidth() {return this.maxX - this.minX}
    get graphHeight() {return this.maxY - this.minY}

    // in box coordinates
    offsetX = 0
    offsetY = 0

    // width + height without the offset, only the content window
    get contentWidth() {return Math.max(0, this.svgWidth - this.offsetX)}
    get contentHeight() {return Math.max(0, this.svgHeight - this.offsetY)}

    contentGroup!: SVGElement
    linesGroup!: SVGElement
    clipPath!:SVGClipPathElement

    override onCreate() {

        if (this.options.show_labels) {
            this.offsetX = 50;
            this.offsetY = 50;
        }
        else {
            this.offsetX = 0;
            this.offsetY = 0;
        }

        this.clipPath = document.createElementNS(svgns, "clipPath");
        this.clipPath.id = UIX.Utils.getUniqueElementId();
        this.svg.append(this.clipPath);

        this.linesGroup = document.createElementNS(svgns, "g");
        this.svg.append(this.linesGroup)

        this.contentGroup = document.createElementNS(svgns, "g");
        this.contentGroup.style.clipPath = `url(#${this.clipPath.id})`;
        this.svg.append(this.contentGroup)

        super.onCreate();
    }


    private generateGrid(){
        // reset lines
        this.linesGroup.innerHTML = "";

        let draw_line = true;

        // generate vertical lines
        const invtervalX = Math.round((this.graphWidth/4)/5)*5;
        const startX = Math.floor((this.minX/5))*5;
        

        if (this.options.show_grid) {
            for (let x = startX; x < this.maxX; x += invtervalX/5) {
                this.generateLine(x, this.minY, x, this.maxY, 1, "#444");
            }
        }
        for (let x = startX; x < this.maxX; x += invtervalX) {
            if (draw_line) this.generateLine(x, this.minY, x, this.maxY, 2, "#666");
            if (this.options.show_labels) this.generateText(x, this.yBoxPositionToPosition(this.svgHeight-20), x.toString(), "var(--text)", "middle", "auto")
            if (!this.options.show_grid) draw_line = false; // only draw outer line
        }

        draw_line = true;

        // generate horizontal lines
        const invtervalY = Math.round((this.maxY/4)/5)*5;
        const startY = Math.floor((this.minY/5))*5;

        if (this.options.show_grid) {
            for (let y =startY; y < this.maxY; y += invtervalY/5) {
                this.generateLine(this.minX, y, this.maxX, y, 1, "#444");
            }
        }
        
        for (let y = startY; y < this.maxY; y += invtervalY) {
            if (draw_line) this.generateLine(this.minX, y, this.maxX, y, 2, "#666");
            if (this.options.show_labels) this.generateText(this.xBoxPositionToPosition(10), y, y.toString(), "var(--text)", "start", "middle")
            if (!this.options.show_grid) draw_line = false; // only draw outer line
        }
    }

    private generateLine(x1:number, y1:number, x2:number, y2:number, strokeWidth = 1, strokeColor = "#444"){
        const line = document.createElementNS(svgns,'line');
        line.setAttribute('x1', this.xPositionToBoxPosition(x1).toString());
        line.setAttribute('y1', this.yPositionToBoxPosition(y1).toString());
        line.setAttribute('x2', this.xPositionToBoxPosition(x2).toString());
        line.setAttribute('y2', this.yPositionToBoxPosition(y2).toString());
        line.style.stroke = strokeColor;
        line.style.strokeWidth = strokeWidth.toString();
        this.linesGroup.append(line);
    }
    
    private generateText(x:number, y:number, text:string, color = "var(--text)", horizontal_align = "middle", vertical_align = "middle"){
        const textEl = document.createElementNS(svgns,'text');
        textEl.setAttribute('x', this.xPositionToBoxPosition(x).toString());
        textEl.setAttribute('y', this.yPositionToBoxPosition(y).toString());
        textEl.style.fill = color;
        textEl.style.textAnchor = horizontal_align;
        textEl.style.dominantBaseline = vertical_align;
        textEl.textContent = text;
        this.linesGroup.append(textEl);
    }
    
    protected handleChartResize(): void {
        this.clipPath.innerHTML = `<rect x="${this.offsetX}" y="${0}" width="${this.contentWidth}" height="${this.contentHeight}" />`
        this.generateGrid();
    }

    protected addGradient(element:SVGElement, styleAttribute:string, colors:{[percent:number]:string}, rotation = 0){
        const gradient = document.createElementNS(svgns, "linearGradient");
        gradient.id = UIX.Utils.getUniqueElementId("gradient_");
        gradient.setAttribute("gradientTransform", "rotate("+rotation+")");

        for (let [percent,color] of Object.entries(colors)) {
            gradient.innerHTML += `<stop offset="${percent}%" stop-color="${color}" />`
        }

        this.svg.append(gradient);
        element.style.setProperty(styleAttribute, `url(#${gradient.id})`);
    }


    // data handlers
    protected onNewDataPoint(label: string, data: any): void {
        if (data instanceof Datex.Value) {
            data.observe((v,k,p) => {
                 // single property update
                 if (p) this.onNewEntry(label, v);
            })
        }

        for (let entry of <Iterable<chart_xy_entry>>Datex.Value.collapseValue(data,true,true)??[]) this.onNewEntry(label, entry);
    }


    protected abstract onNewEntry(label:string, data:any):void


    // utils

    protected positionToBoxPosition(x:number, y:number) {
        return {x: this.xPositionToBoxPosition(x), y:this.yPositionToBoxPosition(y)};
    }

    protected boxPositionToPosition(boxX:number, boxY:number) {
        return {x: this.xBoxPositionToPosition(boxX), y:this.yBoxPositionToPosition(boxY)};
    }

    protected xPositionToBoxPosition(x:number) {
        return (((x-this.minX)/this.graphWidth) * this.contentWidth + this.offsetX) || 0;
    }

    protected yPositionToBoxPosition(y:number) {
        return ((this.svgHeight - ((y-this.minY)/this.graphHeight) * this.contentHeight) - this.offsetY) || 0;
    }

    protected xBoxPositionToPosition(boxX:number) {
        return ((this.graphWidth * (boxX-this.offsetX) / this.contentWidth) + this.minX) || 0;
    }

    protected yBoxPositionToPosition(boxY:number) {
        return ((this.graphHeight * (this.svgHeight - (boxY+this.offsetY)) / this.contentHeight) + this.minY) || 0;
    }


}


@UIX.Component()
export class Graph extends ChartXY<CHART_XY_OPTIONS> {
 
    lines:Map<string,SVGPolylineElement> = new Map();

    #points: Map<string,{x:number, y:number}[]> = new Map();
    #box_points: Map<string, string[]> = new Map()


    protected override onNewDataPoint(label: string, data: any) {
        this.#points.set(label, []);
        this.#box_points.set(label, []);
        this.initLine(label);

        super.onNewDataPoint(label, data);
    }

    protected onDataPointUpdated(label: string, data: any): void {
        throw "TODO"
    }

    protected onNewEntry(label:string, entry: chart_xy_entry): void {
        this.animatePoint(label, Number(entry[0].value), Number(entry[1].value));
    }


    protected initLine(label: string) {
        const line = document.createElementNS(svgns, "polyline");
        line.style.fill = "none";

        const line_width = this.getLabelFormat(label, 'line_width', 4);
        const line_color = this.getLabelFormat(label, 'color', UIX.Theme.getColorReference('light_blue'));

        const lightLineColor = UIX.Utils.lightenDarkenColor(UIX.Utils.getCSSProperty(line_color, false), 20);

        line.style.strokeWidth = line_width.toString();

        
        if (this.options.fill) {
            if (this.options.gradient) this.addGradient(line, "fill", {0:UIX.Utils.getCSSProperty(line_color, true), 100:'transparent'},90);
            else {
                line.style.fill = UIX.Utils.getCSSProperty(line_color, true);
                line.style.fillOpacity = "0.7";
            }
        }

        this.addGradient(line, "stroke", {30:lightLineColor, 100:'#ffffff'},0);

        this.lines.set(label, line);

        this.contentGroup.append(line);
    }




    protected handleChartResize() {
        super.handleChartResize();
        for (let label of this.labels) {
            for (let p = 0; p<this.#points.get(label).length; p++) {
                this.updatePoint(label, p);
            }
            this.refreshLine(label);
        }
       
    }


    private animateNewMax(maxX:number, maxY:number) {
        const startMaxX = this.maxX;
        const startMaxY = this.maxY;

        this.handleAnimation(t=>{
            this.maxX = this.interpolate(startMaxX, maxX, t);
            this.maxY = this.interpolate(startMaxY, maxY, t);
            this.triggerChartResize();
        })
    }

    private animateNewMin(minX:number, minY:number) {
        const startMinX = this.minX;
        const startMinY = this.minY;

        this.handleAnimation(t=>{
            this.minX = this.interpolate(startMinX, minX, t);
            this.minY = this.interpolate(startMinY, minY, t);
            this.triggerChartResize();
        })
    }


    private animatePoint(label:string, x:number, y:number) {
        const points = this.#points.get(label);

        if (!points.length) {
            this.setPoint(label,x,y); // don't animate first point
            return;
        }

        const {x:startX, y:startY} = points[points.length-1];

        const pos = points.length;

        this.handleAnimation(t=>{
            this.setPoint(label, this.interpolate(startX, x, t), this.interpolate(startY, y, t), pos);
        })

    }


    // add a point at a index
    private setPoint(label:string, x:number, y:number, index?:number, updateResize = true){

        const points = this.#points.get(label);

        // resize if out of bounds
        if (updateResize && x > this.maxX) {
            this.animateNewMax(Math.round(x) + 10,this.maxY)
        }
        if (updateResize && y > this.maxY) {
            this.animateNewMax(this.maxX, Math.round(y) + 10)
        }
        if (updateResize && x < this.minX) {
            this.animateNewMin(Math.round(x) - 10, this.minY)
        }
        if (updateResize && y < this.minY) {
            this.animateNewMin(this.minX, Math.round(y) - 10)
        }

        // add start and end points
        if (!points.length) {
            points[0] = {x:-5, y:0};
            points[1] = {x:-5, y:0};
            points[2] = {x:-5, y:y};

            this.updatePoint(label,0);
            this.updatePoint(label,1);
        }

        if (index == undefined) index =points.length;

        points[index] = {x,y};
        this.updatePoint(label, index);

        if (index ==points.length-1) {
           points[0] = {x:x, y:0}; 
            this.updatePoint(label,0); // update path close point
        }
        
        this.refreshLine(label);
    }


    // update box x,y for point and save in and #box_points
    private updatePoint(label:string, index:number) {
        const points = this.#points.get(label);
        const box_position = this.positionToBoxPosition(points[index].x, points[index].y);
        this.#box_points.get(label)[index] = box_position.x + "," + box_position.y;
    }

    // update svg to current #box_points state
    private refreshLine(label:string){
        this.lines.get(label).setAttribute("points", this.#box_points.get(label).join(" "));
    }
}

