/**
 * Initialize new anonymous endpoint session if no endpoint cookies set
 */

import { UIX_COOKIE, getCookie, setCookie } from "./cookies.ts";

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

export async function init() {
	const id = createNewID();
    const keys = await createNewKeys();
	console.log("new id", id, keys);

    // signed endpoint validation cookie
    const nonceBase64 = getCookie(UIX_COOKIE.endpointNonce);
    if (nonceBase64) {
        const nonce = base64ToArrayBuffer(nonceBase64);
        setCookie(UIX_COOKIE.endpointValidation, arrayBufferToBase64(await sign(nonce, keys.keys.sign[1])));
    }

    localStorage.setItem("new_keys", JSON.stringify({endpoint: id, keys: keys.exportedKeys}))
    setCookie(UIX_COOKIE.endpoint, id + '/0001');
    setCookie(UIX_COOKIE.endpointNew, "1");

    window.location.reload();
}


/**
 * Crypto functions
 * (Same as in Datex.Crypto)
 */

const sign_key_generator = {
    name: "ECDSA",
    namedCurve: "P-384"
}

const sign_key_options = {
    name: "ECDSA",
    hash: {name: "SHA-384"},
}

const enc_key_options = {
    name: "RSA-OAEP",
    modulusLength: 4096,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: "SHA-256"
}


async function generateNewKeyPair() {
    // create new encrpytion key pair
    const enc_key_pair = <CryptoKeyPair> await crypto.subtle.generateKey(
        enc_key_options,
        true,
        ["encrypt", "decrypt"]
    );

    // create new sign key pair
    const sign_key_pair = <CryptoKeyPair>await crypto.subtle.generateKey(
        sign_key_generator,
        true,
        ["sign", "verify"]
    );
    return [enc_key_pair, sign_key_pair];
}

async function sign(buffer:ArrayBuffer, signKey: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.sign(sign_key_options, signKey, buffer);
}

// export an public key
function exportPublicKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey("spki", key);
}
// export a private key
function exportPrivateKey(key: CryptoKey): Promise<ArrayBuffer> {
    return crypto.subtle.exportKey("pkcs8", key);
}

function arrayBufferToBase64(arrayBuffer: ArrayBuffer) {
    return btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
}

function base64ToArrayBuffer(base64: string) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (var i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

async function createNewKeys() {
    // create new encrpytion + sign key pair
    const [enc_key_pair, sign_key_pair] = await generateNewKeyPair();
    
    const rsa_dec_key = enc_key_pair.privateKey
    const rsa_enc_key = enc_key_pair.publicKey
    const rsa_sign_key = sign_key_pair.privateKey
    const rsa_verify_key = sign_key_pair.publicKey

    const rsa_enc_key_exported = arrayBufferToBase64(await exportPublicKey(rsa_enc_key));
    const rsa_dec_key_exported = arrayBufferToBase64(await exportPrivateKey(rsa_dec_key));
    const rsa_verify_key_exported = arrayBufferToBase64(await exportPublicKey(rsa_verify_key));
    const rsa_sign_key_exported = arrayBufferToBase64(await exportPrivateKey(rsa_sign_key));

    return {
        keys: {
            sign: [rsa_verify_key, rsa_sign_key],
            encrypt: [rsa_enc_key, rsa_dec_key]
        },
        exportedKeys: {
            sign: [rsa_verify_key_exported, rsa_sign_key_exported],
            encrypt: [rsa_enc_key_exported, rsa_dec_key_exported]
        }
    };
}


await init()