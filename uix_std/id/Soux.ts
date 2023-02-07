import Logger from "../../logger.ts";

let logger = new Logger("SoundX")

const _X_sample_size = 4096;

const _X_fft_start_frequency = 14_000;
const _X_fft_stop_frequency = 19_000;
var _X_sample_rate = 44100

const _X_filter_volume = 88;
var _X_fft_start_index = Math.round((_X_fft_start_frequency*_X_sample_size) / _X_sample_rate);
var _X_fft_stop_index = Math.round((_X_fft_stop_frequency*_X_sample_size) / _X_sample_rate)
var _X_fft_size = _X_fft_stop_index - _X_fft_start_index;

logger.debug("START freq:", _X_fft_start_frequency)
logger.debug("STOP freq:", _X_fft_stop_frequency)


/* ON ESPRUINO:
const START_INDICATOR = 17_000;
const END_INDICATOR = 18_000;
const CONNECTION_INDICATOR = 17_900;

const freq_shift = 1000;

const Freq = {
    0: 17_100,
    1: 17_200,
    2: 17_300,
    3: 17_400,
    4: 17_500,
    5: 17_600,
    6: 17_700,
    7: 17_830,
}

function test(){
    setTimeout(()=>{
        LED1.write(true)
        //[0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 0, 0, 1, 1, 2, 2]
        sendData([0, 1, 2, 3, 0, 1, 2, 4, 0, 1, 2, 5, 0, 1, 2, 6], test);
        setTimeout(()=>LED1.write(false),300);
    }, 4000);
}

test();


function sendData(data:number[], callback?:()=>void) {
    console.log("START");

    playFreq(START_INDICATOR, ()=>{
        // play data as frequencies
       // setTimeout(()=>playFreq(END_INDICATOR, callback), 20);
        playFreqData(data, ()=>{
            playFreq(END_INDICATOR, callback)
        })
    })

}


function playFreqData(f_array:number[], callback?:()=>void, index?){
    if (!index) index = 0;
    if(!f_array.length) {
        console.log("END");
        if (callback) callback();
        return;
    }
    let f = f_array.shift();
    playFreq(Freq[f] - (index++%2)*1000, ()=>playFreqData(f_array, callback, index))
}


function playFreq(f, callback){
    console.log("freq = ", f + " Hz");
    analogWrite(D17, 0.5, { freq : f});
    setTimeout(()=>analogWrite(D17, 0, {freq:0}), 30);
    setTimeout(callback, 40);
}



 */

const Freq = {
    CONNECTION_INDICATOR: 373, //Math.round((14_000*_X_sample_size) / _X_sample_rate),
    START_INDICATOR: 288, //Math.round((16_000*_X_sample_size) / _X_sample_rate),
    END_INDICATOR: 384, //Math.round((15_000*_X_sample_size) / _X_sample_rate),
    0: 297,
    1: 307,
    2: 316,
    3: 326,
    4: 335,
    5: 345,
    6: 354,
    7: 366, // slight change in frequency - is not recognized otherwise
}

const freq_shift = 93;


function updateFreqIndicators(){
    // Freq.CONNECTION_INDICATOR =  Math.round(0.803*_X_fft_size)
    // Freq.START_INDICATOR = Math.round(0.62*_X_fft_size)
    // Freq.END_INDICATOR = Math.round(0.825*_X_fft_size)

    logger.debug("CONNECTION_INDICATOR:", Freq.CONNECTION_INDICATOR)
    logger.debug("START_INDICATOR:", Freq.START_INDICATOR)
    logger.debug("END_INDICATOR:", Freq.END_INDICATOR)
}

export class SoundXListen {

    time = 0;
    audio_ctx: AudioContext;
    audio_analyser: AnalyserNode
    microphone: MediaStreamAudioSourceNode

    recording = false;
    connected = false;

    constructor(){}

    listen(){
        logger.info("start listening")
        this.process();
    }

    onConnect(){}
    onValue(...data:any[]){}

    private data:number[] = [];
    private is_shift = false; // switch between upper and lower band
    private wait_shift = 0 // count up if frequency band not shifted

    private analyzeData(data:number[]){

    }

    private input(data){

        data = this._filter(data)

        let max = this._indexOfMax(data);

        if (data[max]!=0) {

            console.log(max);

            // check START / END
            if (this.isInRange(Freq.CONNECTION_INDICATOR, max)) {
                if (!this.connected) {
                    this.connected = true;
                    logger.success("NEW CONNECTION", data[max])
                    this.onConnect()
                }

            }
            if (this.isInRange(Freq.START_INDICATOR, max)) {
                if (!this.recording ){
                    logger.success("recording started *")
                    this.recording = true;
                    this.is_shift = false;
                    this.wait_shift = 0;
                    this.data = [];
                    // this.block = 0;
                    // setTimeout(()=>{
                    //     this.block_interval = setInterval(()=>{
                    //         // console.log("Block", this.block);
                    //         this.data[++this.block] = []
                    //     }, 35);
                    // }, 35)
                }
            }
            else if (this.isInRange(Freq.END_INDICATOR, max)) {
                if (this.recording) {
                    let res = parseInt( this.data.join(""), 8);
                    logger.error("recording stopped", JSON.stringify(this.data), res);
                    // alert(JSON.stringify(this.data));
                    this.analyzeData(this.data);
                    this.data = [];
                    this.recording = false;
                }
            }


            else if (this.recording) {

                // if (this.data[this.data.length-1] !== max) {
                //     this.data.push(max)
                //     console.log(max + ": ", data[max])
                // }
                if (this.wait_shift>30) {logger.error("INVALID");/*this.recording = false;return;*/}

                if (!this.is_shift) {
                    if (this.isInRange(Freq[0], max)) {this.data.push(0); this.is_shift = true;this.wait_shift = 0;console.log(" +0")}
                    else if (this.isInRange(Freq[1], max)) {this.data.push(1); this.is_shift = true;this.wait_shift = 0;console.log(" +1")}
                    else if (this.isInRange(Freq[2], max)) {this.data.push(2); this.is_shift = true;this.wait_shift = 0;console.log(" +2")}
                    else if (this.isInRange(Freq[3], max)) {this.data.push(3); this.is_shift = true;this.wait_shift = 0;console.log(" +3")}
                    else if (this.isInRange(Freq[4], max)) {this.data.push(4); this.is_shift = true;this.wait_shift = 0;console.log(" +4")}
                    else if (this.isInRange(Freq[5], max)) {this.data.push(5); this.is_shift = true;this.wait_shift = 0;console.log(" +5")}
                    else if (this.isInRange(Freq[6], max)) {this.data.push(6); this.is_shift = true;this.wait_shift = 0;console.log(" +6")}
                    else if (this.isInRange(Freq[7], max)) {this.data.push(7); this.is_shift = true;this.wait_shift = 0;console.log(" +7")}
                    else this.wait_shift++;
                }

                else {
                    if (this.isInRange(Freq[0]-freq_shift, max)) {this.data.push(0); this.is_shift = false;this.wait_shift = 0;console.log(" -0")}
                    else if (this.isInRange(Freq[1]-freq_shift, max)) {this.data.push(1); this.is_shift = false;this.wait_shift = 0;console.log(" -1")}
                    else if (this.isInRange(Freq[2]-freq_shift, max)) {this.data.push(2); this.is_shift = false;this.wait_shift = 0;console.log(" -2")}
                    else if (this.isInRange(Freq[3]-freq_shift, max)) {this.data.push(3); this.is_shift = false;this.wait_shift = 0;console.log(" -3")}
                    else if (this.isInRange(Freq[4]-freq_shift, max)) {this.data.push(4); this.is_shift = false;this.wait_shift = 0;console.log(" -4")}
                    else if (this.isInRange(Freq[5]-freq_shift, max)) {this.data.push(5); this.is_shift = false;this.wait_shift = 0;console.log(" -5")}
                    else if (this.isInRange(Freq[6]-freq_shift, max)) {this.data.push(6); this.is_shift = false;this.wait_shift = 0;console.log(" -6")}
                    else if (this.isInRange(Freq[7]-freq_shift, max)) {this.data.push(7); this.is_shift = false;this.wait_shift = 0;console.log(" -7")}
                    else this.wait_shift++;
                }


            }
            else {
                // this.onValue(max, data[max]);
                // console.log(max + ": ", data[max])
            }
        }

        this.time++
    }


    isInRange(around:number, value) {
        return (value >= around-4 && value <= around+4);
    }

    init(){

        return new Promise(resolve => {
            let constraints:any = {
                audio: {
                    "mandatory": {
                        "googEchoCancellation": "false",
                        "googAutoGainControl": "false",
                        "googNoiseSuppression": "false",
                        "googHighpassFilter": "false"
                    },
                }
            };

            if (navigator.getUserMedia) {
                navigator.getUserMedia(constraints, (stream)=> {
                    this.audio_ctx = new (window.AudioContext || (<any>window).webkitAudioContext)({sampleRate:44100});
                    this.audio_analyser = this.audio_ctx.createAnalyser();
                    this.audio_analyser.fftSize = _X_sample_size;
                    this.microphone = this.audio_ctx.createMediaStreamSource(stream);
                    this.microphone.connect(this.audio_analyser);

                    _X_sample_rate = this.audio_ctx.sampleRate;
                    _X_fft_start_index = Math.round((_X_fft_start_frequency*_X_sample_size) / _X_sample_rate);
                    _X_fft_stop_index = Math.round((_X_fft_stop_frequency*_X_sample_size) / _X_sample_rate)
                    _X_fft_size = _X_fft_stop_index - _X_fft_start_index;
                    updateFreqIndicators();
                    console.log(_X_fft_start_index + "-" + _X_fft_stop_index, _X_sample_rate );
                    logger.success("soundx enabled, sample rate:", _X_sample_rate)
                    resolve(true);
                }, (e)=>{
                    logger.error("audio access not allowed")
                    resolve(false)
                });
            }
            else {
                logger.error("audio not available")
                resolve(false)
            }
        })


    }


    process(){
        if (this.audio_analyser == null) {
            setTimeout(()=>this.process(), 20);
            return;
        }
        let ffts = new Float32Array(this.audio_analyser.frequencyBinCount);
        let new_ffts = new Float32Array(_X_fft_size);

        setInterval(()=>{
            this.audio_analyser.getFloatFrequencyData(ffts);

            for (let i=_X_fft_start_index;i<=_X_fft_stop_index;i++){
                if(ffts[i]<-195){ // -75 // TODO volume filter!!!!!!
                    new_ffts[i-_X_fft_start_index] = 0//100000
                } else {
                    new_ffts[i-_X_fft_start_index] = (195+Math.round(ffts[i]));
                }
            }

            this.input(new_ffts)
        },10);

    }


    _channelDataToBase4Array(channel_data){
        console.log(channel_data)

        let min_rows = Infinity

        for(let c of channel_data){
            if(c[1].length<min_rows) min_rows = c[1].length
            if(c[2].length<min_rows) min_rows = c[2].length
        }

        console.log("rows: " + min_rows)
        
        let base4 = []
        for (let r=0;r<min_rows;r++){
            for (let data of channel_data){
                let i=0

                if(data[1][r]!=undefined) base4.push(data[1][r])
                if(data[2][r]!=undefined) base4.push(data[2][r])

            }

        }

        return base4
    }


    _indexOfMax(arr) {
        if (arr.length === 0) {
            return -1;
        }

        var max = arr[0];
        var maxIndex = 0;

        for (var i = 1; i < arr.length; i++) {
            if (arr[i] > max) {
                maxIndex = i;
                max = arr[i];
            }
        }

        return maxIndex;
    }



    _filter(data){
        for(let d=0;d<data.length;d++){
            if(data[d]<_X_filter_volume){
                data[d] = 0
             }
        }
        return data
    }

}