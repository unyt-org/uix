var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { Datex, pointer } from "unyt_core";
import { UIX } from "uix";
const svgns = "http://www.w3.org/2000/svg";
export function numberValueToChartXYData(value, options) {
    const data = pointer([]);
    function newDataPoint(value) {
        data.push([{ value: data.length }, { value: value }]);
    }
    if (value instanceof Datex.Value)
        value.observe((v) => {
            newDataPoint(v);
        });
    newDataPoint(value instanceof Datex.Value ? value.val : value);
    return data;
}
let Chart = class Chart extends UIX.Components.Base {
    svg;
    svgWidth = 0;
    svgHeight = 0;
    get svgCenterX() { return (this.svgWidth / 2) || 0; }
    get svgCenterY() { return (this.svgHeight / 2) || 0; }
    #labels = new Set();
    get labels() {
        return this.#labels;
    }
    get data() {
        return this.options.data instanceof Datex.Value ? this.options.data.val : this.options.data;
    }
    set data(data) {
        this.options.data = data;
        const dx_value = Datex.Pointer.pointerifyValue(data);
        if (dx_value instanceof Datex.Value) {
            dx_value.observe((v, k, p) => {
                if (p && !this.labels.has(k))
                    this.observeDataPoint(k);
            });
        }
        for (let l of Object.keys(data))
            this.observeDataPoint(l);
    }
    observeDataPoint(label) {
        const data = this.options.$.data.$[label];
        this.labels.add(label);
        if (data instanceof Datex.Value) {
            data.observe((v, k, p) => {
                if (!p) {
                    if (this.labels.has(label))
                        this.onDataPointUpdated(label, this.options.$.data.$[label]);
                    else
                        this.onNewDataPoint(label, this.options.$.data.$[label]);
                }
            });
        }
        this.onNewDataPoint(label, data);
    }
    onInit() {
        this.svg = document.createElementNS(svgns, "svg");
        this.svg.style.display = "block";
        this.svg.style.fontSize = "16px";
        this.content.append(this.svg);
    }
    onCreate() {
        if (!this.options.data)
            return;
        this.data = this.options.data;
        this.updateDimensions();
    }
    onResize() {
        this.triggerChartResize();
    }
    triggerChartResize() {
        this.updateDimensions();
        this.handleChartResize();
    }
    getLabelFormat(label, key, default_value) {
        return this.options.format?.[label]?.[key] ?? default_value;
    }
    handleAnimation(callback, speed = 20) {
        let t = 0;
        const animate = () => {
            const lastT = t;
            const cancel = callback(t);
            t += 1 / speed;
            if (t < 1 && !cancel)
                requestAnimationFrame(() => animate());
            else if (lastT != 1)
                callback(1);
        };
        animate();
    }
    interpolate(start, end, t) {
        return start + t * (end - start);
    }
    updateDimensions() {
        this.svgWidth = this.content.getBoundingClientRect().width;
        this.svgHeight = this.content.getBoundingClientRect().height;
        this.svg.setAttribute("viewBox", "0 0 " + this.svgWidth + " " + this.svgHeight);
        this.svg.setAttribute("width", this.svgWidth.toString());
        this.svg.setAttribute("height", this.svgHeight.toString());
    }
};
Chart = __decorate([
    UIX.Component({
        responsive: true,
    }),
    UIX.Abstract
], Chart);
export { Chart };
let PieChart = class PieChart extends Chart {
    outerCircle;
    maskPath;
    maskCircle;
    sectionGroup;
    sections = new Map();
    sectionValues = new Map();
    get diameter() { return Math.min(this.svgWidth, this.svgHeight) * 0.9; }
    get inner_diameter() { return this.diameter / 2; }
    onCreate() {
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
        const fillRect = document.createElementNS(svgns, "rect");
        fillRect.setAttribute("width", "100%");
        fillRect.setAttribute("height", "100%");
        fillRect.style.fill = "transparent";
        this.sectionGroup.append(fillRect);
        this.svg.append(this.sectionGroup);
        this.svg.append(this.maskPath);
        super.onCreate();
    }
    onNewDataPoint(label, data) {
        const color = this.getLabelFormat(label, 'color', UIX.Theme.getColorReference('light_blue'));
        const section = document.createElementNS(svgns, "g");
        const mainCircle = document.createElementNS(svgns, "circle");
        mainCircle.style.stroke = color;
        mainCircle.style.fill = "transparent";
        section.append(mainCircle);
        let startCircle, endCircle;
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
        this.onDataPointUpdated(label, data);
    }
    onDataPointUpdated(label, data) {
        const startValue = this.sectionValues.get(label);
        const endValue = this.options.data[label];
        this.handleAnimation((t => {
            this.sectionValues.set(label, this.interpolate(startValue ?? 0, (endValue instanceof Datex.Quantity ? endValue.value : Number(endValue)) ?? 0, t));
            this.updateSectionLength(label);
        }));
    }
    handleChartResize() {
        this.outerCircle.setAttribute("cx", this.svgCenterX.toString());
        this.outerCircle.setAttribute("cy", this.svgCenterY.toString());
        this.outerCircle.setAttribute("r", (this.diameter / 2).toString());
        this.maskCircle.setAttribute("cx", this.svgCenterX.toString());
        this.maskCircle.setAttribute("cy", this.svgCenterY.toString());
        this.maskCircle.setAttribute("r", (this.inner_diameter / 2).toString());
        this.maskPath.setAttribute("width", this.svgWidth.toString());
        this.maskPath.setAttribute("height", this.svgHeight.toString());
        for (let label of this.labels) {
            this.updateSection(label);
        }
    }
    updateSection(label) {
        if (!this.sections.has(label))
            throw new Error("Pie Chart section with label '" + label + "' does not exist");
        const [section, mainCircle, startCircle, endCircle] = this.sections.get(label);
        const padding = 0.1;
        const diameter = this.diameter * (1 - padding);
        mainCircle.setAttribute("cx", this.svgCenterX.toString());
        mainCircle.setAttribute("cy", this.svgCenterY.toString());
        mainCircle.setAttribute("r", (diameter / 4).toString());
        mainCircle.style.strokeWidth = (diameter / 2).toString();
        if (this.options.round && startCircle && endCircle) {
            const small_diameter = diameter - this.inner_diameter;
            startCircle.setAttribute("r", (small_diameter / 4).toString());
            startCircle.setAttribute("cx", (this.svgCenterX + (diameter / 2 - small_diameter / 4)).toString());
            startCircle.setAttribute("cy", this.svgCenterY.toString());
            endCircle.setAttribute("r", (small_diameter / 4).toString());
        }
        this.updateSectionLength(label);
    }
    updateSectionLength(label, recursive = true) {
        if (!this.sections.has(label))
            throw new Error("Pie Chart section with label '" + label + "' does not exist");
        const [section, mainCircle, startCircle, endCircle] = this.sections.get(label);
        const padding = 0.1;
        const diameter = this.diameter * (1 - padding);
        const radius = diameter / 2;
        const fraction = this.getSectionValue(label);
        const piR = (Math.PI * diameter / 2);
        if (this.options.round && endCircle) {
            const small_diameter = diameter - this.inner_diameter;
            endCircle.setAttribute("cx", (this.svgCenterX + (radius - small_diameter / 4) * Math.cos(fraction * (2 * Math.PI))).toString());
            endCircle.setAttribute("cy", (this.svgCenterY + (radius - small_diameter / 4) * Math.sin(fraction * (2 * Math.PI))).toString());
        }
        mainCircle.style.strokeDasharray = fraction * piR + " " + piR;
        if (this.options.relative_values && recursive) {
            for (let l of this.labels)
                this.updateSectionLength(l, false);
        }
        else {
            for (let l of this.labels)
                this.updateSectionRotation(l);
        }
    }
    updateSectionRotation(label) {
        const [section,] = this.sections.get(label);
        const rotation = -90 + (this.getSectionRotation(label) * 360);
        section.setAttribute("transform", "rotate(" + rotation + ", " + this.svgCenterX + ", " + this.svgCenterY + ")");
    }
    getSectionValue(label) {
        if (this.options.relative_values)
            return (this.sectionValues.get(label) / this.getCumulativeValue()) || 0;
        else
            return this.sectionValues.get(label);
    }
    getCumulativeValue() {
        let sum = 0;
        for (let label of this.labels) {
            sum += this.sectionValues.get(label) || 0;
        }
        return sum;
    }
    getSectionRotation(label) {
        let rotation = 0;
        for (let other_label of this.labels) {
            if (other_label == label)
                break;
            rotation += this.getSectionValue(other_label);
        }
        return rotation;
    }
    polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }
    updateArc(path, x, y, radius, startAngle, endAngle) {
        const start = this.polarToCartesian(x, y, radius, endAngle);
        const end = this.polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        const d = [
            "M", start.x, start.y,
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y
        ].join(" ");
        path.setAttribute("d", d);
    }
};
PieChart = __decorate([
    UIX.Component({
        round: true
    })
], PieChart);
export { PieChart };
let ChartXY = class ChartXY extends Chart {
    minX = 0;
    minY = 0;
    maxX = 20;
    maxY = 20;
    get graphWidth() { return this.maxX - this.minX; }
    get graphHeight() { return this.maxY - this.minY; }
    offsetX = 0;
    offsetY = 0;
    get contentWidth() { return Math.max(0, this.svgWidth - this.offsetX); }
    get contentHeight() { return Math.max(0, this.svgHeight - this.offsetY); }
    contentGroup;
    linesGroup;
    clipPath;
    onCreate() {
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
        this.svg.append(this.linesGroup);
        this.contentGroup = document.createElementNS(svgns, "g");
        this.contentGroup.style.clipPath = `url(#${this.clipPath.id})`;
        this.svg.append(this.contentGroup);
        super.onCreate();
    }
    generateGrid() {
        this.linesGroup.innerHTML = "";
        let draw_line = true;
        const invtervalX = Math.round((this.graphWidth / 4) / 5) * 5;
        const startX = Math.floor((this.minX / 5)) * 5;
        if (this.options.show_grid) {
            for (let x = startX; x < this.maxX; x += invtervalX / 5) {
                this.generateLine(x, this.minY, x, this.maxY, 1, "#444");
            }
        }
        for (let x = startX; x < this.maxX; x += invtervalX) {
            if (draw_line)
                this.generateLine(x, this.minY, x, this.maxY, 2, "#666");
            if (this.options.show_labels)
                this.generateText(x, this.yBoxPositionToPosition(this.svgHeight - 20), x.toString(), "var(--text)", "middle", "auto");
            if (!this.options.show_grid)
                draw_line = false;
        }
        draw_line = true;
        const invtervalY = Math.round((this.maxY / 4) / 5) * 5;
        const startY = Math.floor((this.minY / 5)) * 5;
        if (this.options.show_grid) {
            for (let y = startY; y < this.maxY; y += invtervalY / 5) {
                this.generateLine(this.minX, y, this.maxX, y, 1, "#444");
            }
        }
        for (let y = startY; y < this.maxY; y += invtervalY) {
            if (draw_line)
                this.generateLine(this.minX, y, this.maxX, y, 2, "#666");
            if (this.options.show_labels)
                this.generateText(this.xBoxPositionToPosition(10), y, y.toString(), "var(--text)", "start", "middle");
            if (!this.options.show_grid)
                draw_line = false;
        }
    }
    generateLine(x1, y1, x2, y2, strokeWidth = 1, strokeColor = "#444") {
        const line = document.createElementNS(svgns, 'line');
        line.setAttribute('x1', this.xPositionToBoxPosition(x1).toString());
        line.setAttribute('y1', this.yPositionToBoxPosition(y1).toString());
        line.setAttribute('x2', this.xPositionToBoxPosition(x2).toString());
        line.setAttribute('y2', this.yPositionToBoxPosition(y2).toString());
        line.style.stroke = strokeColor;
        line.style.strokeWidth = strokeWidth.toString();
        this.linesGroup.append(line);
    }
    generateText(x, y, text, color = "var(--text)", horizontal_align = "middle", vertical_align = "middle") {
        const textEl = document.createElementNS(svgns, 'text');
        textEl.setAttribute('x', this.xPositionToBoxPosition(x).toString());
        textEl.setAttribute('y', this.yPositionToBoxPosition(y).toString());
        textEl.style.fill = color;
        textEl.style.textAnchor = horizontal_align;
        textEl.style.dominantBaseline = vertical_align;
        textEl.textContent = text;
        this.linesGroup.append(textEl);
    }
    handleChartResize() {
        this.clipPath.innerHTML = `<rect x="${this.offsetX}" y="${0}" width="${this.contentWidth}" height="${this.contentHeight}" />`;
        this.generateGrid();
    }
    addGradient(element, styleAttribute, colors, rotation = 0) {
        const gradient = document.createElementNS(svgns, "linearGradient");
        gradient.id = UIX.Utils.getUniqueElementId("gradient_");
        gradient.setAttribute("gradientTransform", "rotate(" + rotation + ")");
        for (let [percent, color] of Object.entries(colors)) {
            gradient.innerHTML += `<stop offset="${percent}%" stop-color="${color}" />`;
        }
        this.svg.append(gradient);
        element.style.setProperty(styleAttribute, `url(#${gradient.id})`);
    }
    onNewDataPoint(label, data) {
        if (data instanceof Datex.Value) {
            data.observe((v, k, p) => {
                if (p)
                    this.onNewEntry(label, v);
            });
        }
        for (let entry of Datex.Value.collapseValue(data, true, true) ?? [])
            this.onNewEntry(label, entry);
    }
    positionToBoxPosition(x, y) {
        return { x: this.xPositionToBoxPosition(x), y: this.yPositionToBoxPosition(y) };
    }
    boxPositionToPosition(boxX, boxY) {
        return { x: this.xBoxPositionToPosition(boxX), y: this.yBoxPositionToPosition(boxY) };
    }
    xPositionToBoxPosition(x) {
        return (((x - this.minX) / this.graphWidth) * this.contentWidth + this.offsetX) || 0;
    }
    yPositionToBoxPosition(y) {
        return ((this.svgHeight - ((y - this.minY) / this.graphHeight) * this.contentHeight) - this.offsetY) || 0;
    }
    xBoxPositionToPosition(boxX) {
        return ((this.graphWidth * (boxX - this.offsetX) / this.contentWidth) + this.minX) || 0;
    }
    yBoxPositionToPosition(boxY) {
        return ((this.graphHeight * (this.svgHeight - (boxY + this.offsetY)) / this.contentHeight) + this.minY) || 0;
    }
};
ChartXY = __decorate([
    UIX.Component({
        fill: true,
        gradient: true,
        show_labels: true,
        show_grid: true
    }),
    UIX.Abstract
], ChartXY);
export { ChartXY };
let Graph = class Graph extends ChartXY {
    lines = new Map();
    #points = new Map();
    #box_points = new Map();
    onNewDataPoint(label, data) {
        this.#points.set(label, []);
        this.#box_points.set(label, []);
        this.initLine(label);
        super.onNewDataPoint(label, data);
    }
    onDataPointUpdated(label, data) {
        throw "TODO";
    }
    onNewEntry(label, entry) {
        this.animatePoint(label, Number(entry[0].value), Number(entry[1].value));
    }
    initLine(label) {
        const line = document.createElementNS(svgns, "polyline");
        line.style.fill = "none";
        const line_width = this.getLabelFormat(label, 'line_width', 4);
        const line_color = this.getLabelFormat(label, 'color', UIX.Theme.getColorReference('light_blue'));
        const lightLineColor = UIX.Utils.lightenDarkenColor(UIX.Utils.getCSSProperty(line_color, false), 20);
        line.style.strokeWidth = line_width.toString();
        if (this.options.fill) {
            if (this.options.gradient)
                this.addGradient(line, "fill", { 0: UIX.Utils.getCSSProperty(line_color, true), 100: 'transparent' }, 90);
            else {
                line.style.fill = UIX.Utils.getCSSProperty(line_color, true);
                line.style.fillOpacity = "0.7";
            }
        }
        this.addGradient(line, "stroke", { 30: lightLineColor, 100: '#ffffff' }, 0);
        this.lines.set(label, line);
        this.contentGroup.append(line);
    }
    handleChartResize() {
        super.handleChartResize();
        for (let label of this.labels) {
            for (let p = 0; p < this.#points.get(label).length; p++) {
                this.updatePoint(label, p);
            }
            this.refreshLine(label);
        }
    }
    animateNewMax(maxX, maxY) {
        const startMaxX = this.maxX;
        const startMaxY = this.maxY;
        this.handleAnimation(t => {
            this.maxX = this.interpolate(startMaxX, maxX, t);
            this.maxY = this.interpolate(startMaxY, maxY, t);
            this.triggerChartResize();
        });
    }
    animateNewMin(minX, minY) {
        const startMinX = this.minX;
        const startMinY = this.minY;
        this.handleAnimation(t => {
            this.minX = this.interpolate(startMinX, minX, t);
            this.minY = this.interpolate(startMinY, minY, t);
            this.triggerChartResize();
        });
    }
    animatePoint(label, x, y) {
        const points = this.#points.get(label);
        if (!points.length) {
            this.setPoint(label, x, y);
            return;
        }
        const { x: startX, y: startY } = points[points.length - 1];
        const pos = points.length;
        this.handleAnimation(t => {
            this.setPoint(label, this.interpolate(startX, x, t), this.interpolate(startY, y, t), pos);
        });
    }
    setPoint(label, x, y, index, updateResize = true) {
        const points = this.#points.get(label);
        if (updateResize && x > this.maxX) {
            this.animateNewMax(Math.round(x) + 10, this.maxY);
        }
        if (updateResize && y > this.maxY) {
            this.animateNewMax(this.maxX, Math.round(y) + 10);
        }
        if (updateResize && x < this.minX) {
            this.animateNewMin(Math.round(x) - 10, this.minY);
        }
        if (updateResize && y < this.minY) {
            this.animateNewMin(this.minX, Math.round(y) - 10);
        }
        if (!points.length) {
            points[0] = { x: -5, y: 0 };
            points[1] = { x: -5, y: 0 };
            points[2] = { x: -5, y: y };
            this.updatePoint(label, 0);
            this.updatePoint(label, 1);
        }
        if (index == undefined)
            index = points.length;
        points[index] = { x, y };
        this.updatePoint(label, index);
        if (index == points.length - 1) {
            points[0] = { x: x, y: 0 };
            this.updatePoint(label, 0);
        }
        this.refreshLine(label);
    }
    updatePoint(label, index) {
        const points = this.#points.get(label);
        const box_position = this.positionToBoxPosition(points[index].x, points[index].y);
        this.#box_points.get(label)[index] = box_position.x + "," + box_position.y;
    }
    refreshLine(label) {
        this.lines.get(label).setAttribute("points", this.#box_points.get(label).join(" "));
    }
};
Graph = __decorate([
    UIX.Component()
], Graph);
export { Graph };
