/**
 ╔══════════════════════════════════════════════════════════════════════════════════════╗
 ║  IdBox - UIX Standard Lib                                                            ║
 ╠══════════════════════════════════════════════════════════════════════════════════════╣
 ║  connection interface to the UnytPen                                                 ║
 ║  Visit https://docs.unyt.cc/unyt for more information                                ║
 ╠═════════════════════════════════════════╦════════════════════════════════════════════╣
 ║  © 2020 Jonas & Benedikt Strehle        ║                                            ║
 ╚═════════════════════════════════════════╩════════════════════════════════════════════╝
 */

// ---

import {SoundXListen} from "./Soux.ts";
import {BLEListener} from "./BLE.ts";
import $ from "../../lib/jquery.module.ts";
import UIX from "../../uix.ts";

import Logger from "../../logger.ts";
import {SVGContainer} from "../charts/main.ts";
const logger = new Logger("id")


@UIX.Meta({ author: ":unyt:", app: ":unyt:"})
@UIX.Component<UIX.Options.SVG_OPTIONS>({
    max_svg_width: null,
    max_svg_height:  null
})
@UIX.NoResources
export class IdBox<O extends UIX.Options.SVG_OPTIONS = UIX.Options.SVG_OPTIONS> extends SVGContainer<O> {

    private pp_x
    private pp_y;

    private scale = 1;

    private active = false;

    private data_out_circle;
    private highlight_circle;
    private highlight_big_circle;
    private debug_text;

    private initialized = false;

    private sound_x:SoundXListen;
    private ble:BLEListener;


    async init(){
        if (this.initialized) return;
        this.initialized = true;

        // this.sound_x = new SoundXListen();
        // if (!await this.sound_x.init()) {
        //     return;
        // }

        // this.ble = new BLEListener();
        // if (!await this.ble.init()) {
        //     return;
        // }

        if(!this.is_touch_device) {
            this.noTouchPen()
        }
    }

    get is_touch_device() {
        try {
            document.createEvent("TouchEvent");
            return true;
        } catch (e) {
            return false;
        }
    }

    protected noTouchPen(){
        logger.debug("creating non touch marker")
        this.recognizedPen(false);
    }

    protected async connectionBeacon(continuous=false){
        await this.dataOut(continuous ? [1,0,1] : [1,0,1])
        if (continuous) {
            setTimeout(()=>this.connectionBeacon(true), 80);
        }
    }

    protected recognizedPen(touch, x:number=this.options.svg_width/2, y:number=this.options.svg_height/2){
        this.removePen();
        this.active = true;
        this.pp_x = x;
        this.pp_y = y;

        this.scale = 2800/$(this.svg.node).width();

        this.data_out_circle = this.svg.circle(8*this.scale).cx(this.pp_x).cy(this.pp_y).fill({"color":"white"})
        this.debug_text = this.svg.text("").x(30).y(8).attr("font-size", "30px").attr("color", "white")
        logger.success("recognized pen at " + this.pp_x + " - " + this.pp_y);

        // this.connectionBeacon(!touch);

        // start listening for connection signal
        // this.sound_x.listen()
        //
        // this.sound_x.onConnect = ()=>{
        //     this.highlightPen();
        // }

        this.highlightPen()
    }


    protected removePen(){
        this.active = false;
        this.highlight_circle?.remove()/*.animate(70*this.scale)*/
        this.highlight_big_circle?.remove()/*.animate(100*this.scale)*/
        this.data_out_circle?.remove();
        this.debug_text?.remove();

        // this.sound_x.onConnect = ()=>{}
        //
        // this.sound_x.connected = false;
    }

    protected hidePen(){

    }

    protected highlightPen() {

        this.highlight_circle?.remove();
        this.highlight_big_circle?.remove();
        this.data_out_circle?.remove();

        this.highlight_circle = this.svg.circle(3*this.scale).cx(this.pp_x).cy(this.pp_y).fill({"color":"rgba(39,113,254,0.88)"})
        this.highlight_circle/*.animate()*/.size(20*this.scale)

        this.highlight_big_circle = this.svg.circle(3*this.scale).cx(this.pp_x).cy(this.pp_y).fill({"color":"rgba(89,166,254,0.48)"})
        this.highlight_big_circle/*.animate(500)*/.size(30*this.scale)

        // // setTimeout(()=>{
        //     if(this.active) {
        //
        //         // DEBUG
        //         this.dataOut([0,0,0,1,0,1,0,1,0,1,0,0])
        //     }
        // // },300)
    }


    private async dataOut(data:number[]) {
        for (let n of data) {
            await sleep(80);
            this.data_out_circle.fill({"color":n==0 ? "black":"white"})
        }
    }


    protected createSVG() {
        super.createSVG();
        // Create an SVGPoint for future math
        var pt = this.svg.node.createSVGPoint();

// Get point in global SVG space
        let cursorPoint = (x, y)=>{
            pt.x = x; pt.y = y;
            return pt.matrixTransform(this.svg.node.getScreenCTM().inverse());
        }

        this.html.on("touchmove", (e)=>{
            let x,y;
            if(e.type == 'touchmove'){
                let evt = (typeof e.originalEvent === 'undefined') ? e : e.originalEvent;
                let touch = evt.touches[0] || evt.changedTouches[0];
                x = touch.pageX;
                y = touch.pageY;
            } else if (e.type == 'mousemove') {
                x = e.clientX;
                y = e.clientY;
            }

            let pos = cursorPoint(x,y);
            this.highlight_big_circle?.cx(pos.x).cy(pos.y);
            this.highlight_circle?.cx(pos.x).cy(pos.y);
            this.data_out_circle?.cx(pos.x).cy(pos.y);
        })

        this.html.on("click", (e)=>{
            this.init();
        });

        // this.html.on("touchend", (e)=>{
        //     this.init();
        // });

        this.html.on("touchstart", (e)=>{
            // this.init();
            let x,y;
            if(e.type == 'touchstart' || e.type == 'touchmove' || e.type == 'touchend' || e.type == 'touchcancel'){
                let evt = (typeof e.originalEvent === 'undefined') ? e : e.originalEvent;
                let touch = evt.touches[0] || evt.changedTouches[0];
                x = touch.pageX;
                y = touch.pageY;
            } else if (e.type == 'mousedown' || e.type == 'mouseup' || e.type == 'mousemove' || e.type == 'mouseover'|| e.type=='mouseout' || e.type=='mouseenter' || e.type=='mouseleave') {
                x = e.clientX;
                y = e.clientY;
            }

            let pos = cursorPoint(x,y);

            // this.svg.circle(200).cx(pos.x).cy(pos.y).fill({"color":"#1595c7"})

            this.recognizedPen(true, pos.x, pos.y);
            this.highlightPen()

            // this.connectionBeacon(false);

            e.preventDefault();
        })

        this.html.on("touchend touchcancel", (e)=>{
            this.removePen();
        })
    }

    // private getOffset() {
    //     const rect = this.svg.node.getBoundingClientRect();
    //     return {
    //         left: rect.left + window.scrollX,
    //         top: rect.top + window.scrollY,
    //         width: rect.width,
    //         height: rect.height
    //     };
    // }

    protected draw() {
        this.svg.css('background', '#eeeeee22')

        this.updateData();
    }

    protected updateData() {

    }

}

function sleep(time: number){
    return new Promise(resolve=>setTimeout(resolve, time))
}