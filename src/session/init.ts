/**
 * Initialize new anonymous endpoint session if no endpoint cookies set
 */

import { UIX_COOKIE, setCookie } from "./cookies.ts";

const BIG_BANG_TIME = new Date(2022, 0, 22, 0, 0, 0, 0).getTime();

// TODO: import
function createNewID() {
	const id = new DataView(new ArrayBuffer(16));
	const timestamp = Math.round((new Date().getTime() - BIG_BANG_TIME));
	id.setBigUint64(0, BigInt(timestamp), true); // timestamp
	id.setBigUint64(8, BigInt(Math.floor(Math.random() * (2**64))), true); // random number
	return `@@${buffer2hex(new Uint8Array(id.buffer))}`;
}

function buffer2hex(buffer:Uint8Array|ArrayBuffer, seperator?:string, pad_size_bytes?:number, x_shorthand = false):string {
    if (buffer instanceof ArrayBuffer) buffer = new Uint8Array(buffer);

    // first pad buffer
    if (pad_size_bytes) buffer = buffer.slice(0, pad_size_bytes);

    let array:string[] = <string[]> Array.prototype.map.call(buffer, x => ('00' + x.toString(16).toUpperCase()).slice(-2))
    let skipped_bytes = 0;

    // collapse multiple 0s to x...
    if (x_shorthand) {
        array = array.slice(0,pad_size_bytes).reduce((previous, current) => {
            if (current == '00') {
                if (previous.endsWith('00')) {
                    skipped_bytes++;
                    return previous.slice(0, -2) + "x2"; // add to existing 00
                }
                else if (previous[previous.length-2] == 'x') {
                    const count = (parseInt(previous[previous.length-1],16)+1);
                    if (count <= 0xf) {
                        skipped_bytes++;
                        return previous.slice(0, -1) + count.toString(16).toUpperCase()  // add to existing x... max 15
                    }
                }
            }
            return previous + current;
        }).split(/(..)/g).filter(s=>!!s);
    }

    if (pad_size_bytes != undefined) array = Array.from({...array, length: pad_size_bytes-skipped_bytes}, x=>x==undefined?'00':x); // pad

    return array.join(seperator??'');
}

export function init() {
	const id = createNewID();
	console.log("new id",id);
    // TODO: create + store keys, create signed endpoint validation cookie
	setCookie(UIX_COOKIE.endpoint, id + '/0001');
    window.location.reload();
}

await init()