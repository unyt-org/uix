import { Datex } from "unyt_core";
import { INVALID, VOID } from "unyt_core/datex_all.ts";
import { UIX } from "../../uix.ts";



// <AStream> class, includes an automatic conversion from a provided MediaStream to buffer chunks that are written into the stream & conversion from stream back to Audio
export class AudioStream extends Datex.Stream {

    public context = new AudioContext();
    private recording = false;
    private playing = false;
  
    // record from microphone and write audio data to the stream
    async recordToStream(){

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
        });

        this.recording = true;

        const timeSlice = 120;
        let mediaRecorder:MediaRecorder;

        // create new mediarecorder for each chunk -> returns ogg audio file
        const record_chunk = () => {
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = async e => {
                const buffer = await e.data.arrayBuffer();
                if (this.recording) {
                    //console.log("recorded", e.data);
                    this.write(buffer)
                    record_chunk()
                }
            }
            mediaRecorder.start();
            setTimeout(function() {
                mediaRecorder.stop(); // stop recorder after every time-slice
            }, timeSlice);
        }

        record_chunk();
    }

    // play any data passed to the stream as audio
    async playFromStream() {
        this.playing = true;
    }

    async write (chunk: ArrayBuffer) {
        if (this.playing) { // is a 'writeable stream' (audio in)
            const source_node = this.context.createBufferSource();
            source_node.buffer = await this.context.decodeAudioData(chunk);
            source_node.connect(this.context.destination);
            // start the source playing
            source_node.start();
            console.log("playing chunk");
        }
        else {  // is a 'readable stream' (audio out)
            super.write(chunk) 
        }
    }

    close() {
        this.recording = false;
        this.playing = false;
        super.close();
    }

}


Datex.Type.get("meet", "AudioStream").setJSInterface({
    class: AudioStream,
    serialize: () => VOID,
    cast: (value) => value === VOID ? new AudioStream() : INVALID,

    get_property: (value:AudioStream, key) => {
        switch (key) {
            case "play": return Datex.Function.createFromJSFunction(value.playFromStream, value); // convert functions to <Function>
            case "record": return Datex.Function.createFromJSFunction(value.recordToStream, value)
        }
    }
});



@UIX.Component({icon:"fa-video"})
@UIX.NoResources
export class UnytMeetView extends UIX.Components.Base {

}