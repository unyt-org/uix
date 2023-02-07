import { Datex, datex, f, property, remote, scope, template  } from "unyt_core";

import {UIX, S} from "uix";
import {DatexValueTreeView} from "../datex/main.ts";

UIX.Res.addStrings({
    de: {
        'clear_terminal': 'Verlauf löschen'
    },
    en: {
        'clear_terminal': 'Clear History'
    }
})


@scope('ssh') export class _SSH {
    @remote static connect(host:string, port:number, username:string, passsword?:string, private_key?:string): Promise<SSHConnection> {return null}
}
const SSH = Datex.datex_advanced(_SSH);

@template class SSHConnection {
    @property host:string
    @property port:number
    @property username:string
    
    @property out_stream: Datex.Stream<ArrayBuffer|string>
    @property in_stream: Datex.Stream<ArrayBuffer|string>
}

globalThis.SSH = SSH

export interface TERMINAL_OPTIONS extends UIX.Components.Base.Options {
    out?:Datex.Stream<ArrayBuffer|string>,
    in?:Datex.Stream<ArrayBuffer|string>
}

export interface SSH_TERMINAL_OPTIONS extends TERMINAL_OPTIONS {
    host?:string
    port?:number
    username?:string
    password?:string
    private_key?:string,
    endpoint?:Datex.endpoint_name,
    connection?:SSHConnection
}



// Terminal in debug mode
UIX.Debug.createDebugModeStyleRules(()=>{
    console.log("create czstom debug");
    return [
        '.term-row span {outline: 1px solid cyan;}'
    ]
})


enum CURSOR_STYLE {
    BLOCK,
    UNDERLINE,
    BAR
}

@UIX.Id("Terminal")
@UIX.Component<TERMINAL_OPTIONS>({
    vertical_align:UIX.Types.VERTICAL_ALIGN.TOP,
    horizontal_align:UIX.Types.HORIZONTAL_ALIGN.LEFT,
    bg_color: UIX.Theme.getColorReference('bg_console'),
    icon: 'fa-terminal',
    padding: 10,
})
export class Terminal<O extends TERMINAL_OPTIONS = TERMINAL_OPTIONS> extends UIX.Components.Base<O> {

    private terminal_div: HTMLDivElement
    private text_div: HTMLDivElement
    private input_div: HTMLInputElement
    private cursor: HTMLSpanElement
    private cursor_row: HTMLDivElement
    private cursor_ghost_text: HTMLSpanElement
    private cursor_info: HTMLDivElement
    private cursor_ghost_rows: HTMLDivElement
    private cursor_div: HTMLDivElement

    private text_decoder = new TextDecoder()
    private text_encoder = new TextEncoder()

    override onCreate() {
        this.content.style.width = "100%";
        this.content.style.height = "100%";
        UIX.Utils.setCSSProperty(this.content, '--bg', this.options_props.bg_color) // to add bg color to text spans

        this.handleInStream();

        if (this.out_stream) this.input_div?.focus();
    }

    #in_stream:Datex.Stream<ArrayBuffer|string>;
    #out_stream:Datex.Stream<ArrayBuffer|string>;

    public get in_stream(){return this.options.in || this.#in_stream;}
    public set in_stream(in_stream:Datex.Stream<ArrayBuffer|string>){ this.#in_stream = in_stream;this.handleInStream();}

    public get out_stream(){return this.options.out || this.#out_stream;}
    public set out_stream(out_stream:Datex.Stream<ArrayBuffer|string>){ this.#out_stream = out_stream;this.initTerminal();}

    #reading_stream:Datex.Stream<ArrayBuffer|string>


    private resources = {
        backarrowKey: true, // true = backspace, false = delete
        modifyKeyboard: 0,
        modifyCursorKeys: 2,
        modifyOtherKeys: 0,
        modifyFunctionKeys: 2
    }

    private bracketed_paste_mode = false;
    private normal_cursor_keys = true;
    private normal_keypad = true;


    protected createContextMenu() {
        return {
            clear_console: {
                text: S`clear_terminal`,
                handler: ()=>{
                    this.clear()
                }
            },
        }
    }

    onInit() {
        this.initTerminal();
    }

    // connect new in_stream
    async handleInStream() {
        // has in stream and not already reading
        if (this.in_stream && this.in_stream!=this.#reading_stream) {
            this.#reading_stream = this.in_stream;
            const current_in_stream = this.in_stream;
            const stream_reader = this.in_stream.getReader();
            while (true) {
                const {value} = await stream_reader.read();
                if (current_in_stream != this.in_stream) break; // currently in stream invalidated
                if (value) this.insertRawText(typeof value == "string" ? value : this.text_decoder.decode(value));
            }
        }
    }

    // create DOM, handles out stream
    private initTerminal() {
        this.terminal_div = document.createElement("div");
        this.terminal_div.classList.add("terminal");
        
        // create screen buffer divs
        this.#normal_screen_buffer.text_div = document.createElement("div");
        this.#normal_screen_buffer.text_div.style.lineHeight = "1.29em";
        this.#normal_screen_buffer.text_div.style.width = "100%";
        this.#normal_screen_buffer.text_div.style.overflow = "hidden";

        this.#alternate_screen_buffer.text_div = document.createElement("div");
        this.#alternate_screen_buffer.text_div.style.lineHeight = "1.29em";
        this.#alternate_screen_buffer.text_div.style.width = "100%";
        this.#alternate_screen_buffer.text_div.style.overflow = "hidden";

        this.useNormalScreenBuffer(); // use normal screen buffer per default
        this.terminal_div.append(this.text_div);


        this.cursor_div = document.createElement("div");
        this.cursor_div.style.position = "absolute";
        this.cursor_div.style.top = "0";
        this.cursor_div.style.left = "0";
        this.cursor_div.style.lineHeight = "1.29em";
        this.cursor_div.style.width = "100%";
        this.cursor_div.style.overflow = "hidden";
        this.cursor_div.style.pointerEvents = "none";

        this.cursor_row = document.createElement("div");
        this.cursor = document.createElement("span");
        this.cursor.classList.add("cursor");
        this.cursor.innerHTML = "_";
        this.cursor_ghost_rows = document.createElement("div");
        this.cursor_ghost_rows.style.visibility = "hidden";
        this.cursor_ghost_text = document.createElement("span");
        this.cursor_ghost_text.style.visibility = "hidden";

        this.cursor_info = document.createElement("div");
        this.cursor_info.innerText = '012345678901234567890123456789';
        this.cursor_info.style.background = "#ccc";
        this.cursor_info.style.color = "black";

        this.cursor_row.append(this.cursor_ghost_text);
        this.cursor_row.append(this.cursor);
        //this.cursor_row.append(this.cursor_info);
        this.cursor_div.append(this.cursor_ghost_rows);
        this.cursor_div.append(this.cursor_row);

        this.input_div = document.createElement("input");
        this.input_div.setAttribute("type", "text");
        this.input_div.style.width = "0px";
        this.input_div.style.height = "0px";
        this.input_div.style.opacity = "0";
        this.input_div.style.position = "fixed";
        this.input_div.style.top = "0";
        this.input_div.style.left = "0";

        this.terminal_div.append(this.cursor_div);
        this.terminal_div.append(this.input_div);


        // user input required?
        if (this.out_stream) {
            
            this.input_div.addEventListener("input", (event:InputEvent) => {
                //this.ssh_connection.write(event.data);
                this.send(event.data)
                event.preventDefault();
            })
    
            this.input_div.addEventListener("paste", (event) => {
                var pasted = event.clipboardData.getData('Text');
                if (this.bracketed_paste_mode) pasted = `\x1b[200~${pasted}\x1b[201~`// wrap in escape sequences
                //this.ssh_connection.write(pasted);
                this.send(pasted)
                event.preventDefault();
            })
            
            this.input_div.addEventListener("keydown", (event) => {
                let control_seq =  this.keyInputToControlSequence(event)
                //if (control_seq) this.ssh_connection.write(control_seq);
                if (control_seq) this.send(control_seq)
            })
        }
        else this.cursor.style.visibility = "hidden";
        

        this.content.innerHTML = "";
        this.content.append(this.makeScrollContainer(this.terminal_div, true, true));

        this.content_container.addEventListener("mouseup", e=>{
            setTimeout(()=>{
                let selection = window.getSelection();
                if (selection.type !== "Range" && this.out_stream) {
                    this.input_div?.focus();
                }
            }, 10);
        })

        this.steady_cursor = true;
        this.cursor_style = CURSOR_STYLE.BLOCK;
    }


    protected send(text:string) {
        if (!this.out_stream) this.logger.error("output stream does not exist");
        else this.out_stream.write(this.text_encoder.encode(text))
    }

    // get ascii control sequences from key events (e.g. ^C)
    private keyInputToControlSequence(e: KeyboardEvent){
        let control_seq: string;

        // sed -n l
        // showkey -a
        if      (e.key == "Enter")          control_seq = this.normal_keypad ? '\n' : '\x1bOM';
        else if (e.key == "Tab")            control_seq = this.normal_keypad ? '\u0009' : '\x1bOI';
        else if (e.key == "Backspace")      control_seq = this.resources.backarrowKey ? '\b' : '\x7f';
        else if (e.key == "Delete")         control_seq = '\x1b[3~';

        else if (e.key == "ArrowUp")        control_seq = this.normal_cursor_keys ? '\x1b[A' : '\x1bOA';
        else if (e.key == "ArrowDown")      control_seq = this.normal_cursor_keys ? '\x1b[B' : '\x1bOB';
        else if (e.key == "ArrowRight")     control_seq = this.normal_cursor_keys ? '\x1b[C' : '\x1bOC';
        else if (e.key == "ArrowLeft")      control_seq = this.normal_cursor_keys ? '\x1b[D' : '\x1bOD';

        else if (e.key == "PageDown")       control_seq = '\x1b[6~';
        else if (e.key == "PageUp")         control_seq = '\x1b[5~';
        else if (e.key == "Home")           control_seq = this.normal_cursor_keys ? '\x1b[H' : '\x1bOH';
        else if (e.key == "End")            control_seq = this.normal_cursor_keys ? '\x1b[F' : '\x1bOF';

        else if (e.key == "Escape")         control_seq = '\x1b';

        else if (e.key == "Space")          control_seq = this.normal_keypad ? ' ' : '\x1bO ';

        else if (e.key == "NumpadMultiply") control_seq = this.normal_keypad ? '*' : '\x1bOj';
        else if (e.key == "NumpadAdd")      control_seq = this.normal_keypad ? '+' : '\x1bOk';
        else if (e.key == "NumpadDecimal")  control_seq = this.normal_keypad ? ',' : '\x1bOl';
        else if (e.key == "NumpadSubtract") control_seq = this.normal_keypad ? '-' : '\x1bOm';
        else if (e.key == "NumLock")        control_seq = this.normal_keypad ? '.' : '\x1b[3~';
        else if (e.key == "NumpadDivide")   control_seq = this.normal_keypad ? '/' : '\x1bOo';
        else if (e.key == "Numpad0")        control_seq = this.normal_keypad ? '0' : '\x1b[2~';
        else if (e.key == "Numpad1")        control_seq = this.normal_keypad ? '1' : '\x1bOF';
        else if (e.key == "Numpad2")        control_seq = this.normal_keypad ? '2' : '\x1b[B';
        else if (e.key == "Numpad3")        control_seq = this.normal_keypad ? '3' : '\x1b[6~';
        else if (e.key == "Numpad4")        control_seq = this.normal_keypad ? '4' : '\x1b[D';
        else if (e.key == "Numpad5")        control_seq = this.normal_keypad ? '5' : '\x1b[E';
        else if (e.key == "Numpad6")        control_seq = this.normal_keypad ? '6' : '\x1b[C';
        else if (e.key == "Numpad7")        control_seq = this.normal_keypad ? '7' : '\x1bOH';
        else if (e.key == "Numpad8")        control_seq = this.normal_keypad ? '8' : '\x1b[A';
        else if (e.key == "Numpad9")        control_seq = this.normal_keypad ? '9' : '\x1b[5~';
        else if (e.key == "Numpad9")        control_seq = this.normal_keypad ? '9' : '\x1b[5~';
        else if (e.key == "NumpadEqual")    control_seq = this.normal_keypad ? '=' : '\x1bOX';


        else if (e.key == "a" && e.ctrlKey) control_seq = '\u0001';
        else if (e.key == "b" && e.ctrlKey) control_seq = '\u0002';
        else if (e.key == "c" && e.ctrlKey) control_seq = '\u0003';
        else if (e.key == "d" && e.ctrlKey) control_seq = '\u0004';
        else if (e.key == "e" && e.ctrlKey) control_seq = '\u0005';
        else if (e.key == "f" && e.ctrlKey) control_seq = '\u0006';
        else if (e.key == "g" && e.ctrlKey) control_seq = '\u0007';
        else if (e.key == "h" && e.ctrlKey) control_seq = '\u0008';
        else if (e.key == "i" && e.ctrlKey) control_seq = '\u0009';
        else if (e.key == "j" && e.ctrlKey) control_seq = '\u000a';
        else if (e.key == "k" && e.ctrlKey) control_seq = '\u000b';
        else if (e.key == "l" && e.ctrlKey) control_seq = '\u000c';
        else if (e.key == "m" && e.ctrlKey) control_seq = '\u000d';
        else if (e.key == "n" && e.ctrlKey) control_seq = '\u000e';
        else if (e.key == "o" && e.ctrlKey) control_seq = '\u000f';
        else if (e.key == "p" && e.ctrlKey) control_seq = '\u0010';
        else if (e.key == "q" && e.ctrlKey) control_seq = '\u0011';
        else if (e.key == "r" && e.ctrlKey) control_seq = '\u0012';
        else if (e.key == "s" && e.ctrlKey) control_seq = '\u0013';
        else if (e.key == "t" && e.ctrlKey) control_seq = '\u0014';
        else if (e.key == "u" && e.ctrlKey) control_seq = '\u0015';
        else if (e.key == "v" && e.ctrlKey) control_seq = '\u0016';
        else if (e.key == "w" && e.ctrlKey) control_seq = '\u0017';
        else if (e.key == "x" && e.ctrlKey) control_seq = '\u0018';
        else if (e.key == "y" && e.ctrlKey) control_seq = '\u0019';
        else if (e.key == "z" && e.ctrlKey) control_seq = '\u001A';

        else if (e.key == "F1")      control_seq = '\x1bOP';
        else if (e.key == "F2")      control_seq = '\x1bOQ';
        else if (e.key == "F3")      control_seq = '\x1bOR';
        else if (e.key == "F4")      control_seq = '\x1bOS';
        else if (e.key == "F5")      return;// ignore //control_seq = '\x1b15~';
        else if (e.key == "F6")      control_seq = '\x1b17~';
        else if (e.key == "F7")      control_seq = '\x1b18~';
        else if (e.key == "F8")      control_seq = '\x1b19~';
        else if (e.key == "F9")      control_seq = '\x1b20~';
        else if (e.key == "F10")      control_seq = '\x1b21~';
        else if (e.key == "F11")      control_seq = '\x1b23~';
        else if (e.key == "F12")      return;// ignore // control_seq = '\x1b24~';
        else if (e.key == "F13")      control_seq = '\x1b25~';
        else if (e.key == "F14")      control_seq = '\x1b26~';
        else if (e.key == "F15")      control_seq = '\x1b28~';
        else if (e.key == "F16")      control_seq = '\x1b29~';
        else if (e.key == "F17")      control_seq = '\x1b31~';
        else if (e.key == "F18")      control_seq = '\x1b32~';
        else if (e.key == "F19")      control_seq = '\x1b33~';
        else if (e.key == "F20")      control_seq = '\x1b34~';

        else if (e.key == "F5" && e.shiftKey) control_seq = '\u000925~';
        else if (e.key == "F6" && e.shiftKey) control_seq = '\u000926~';
        else if (e.key == "F7" && e.shiftKey) control_seq = '\u000928~';
        else if (e.key == "F8" && e.shiftKey) control_seq = '\u000929~';
        else if (e.key == "F9" && e.shiftKey) control_seq = '\u000931~';
        else if (e.key == "F10" && e.shiftKey) control_seq = '\u000932~';
        else if (e.key == "F11" && e.shiftKey) control_seq = '\u000933~';
        else if (e.key == "F12" && e.shiftKey) control_seq = '\u000934~';


        else if (e.key == "F1" && e.metaKey)      control_seq = '\x1b17~';
        else if (e.key == "F2" && e.metaKey)      control_seq = '\x1b18~';
        else if (e.key == "F3" && e.metaKey)      control_seq = '\x1b19~';
        else if (e.key == "F4" && e.metaKey)      control_seq = '\x1b20~';
        else if (e.key == "F5" && e.metaKey)      control_seq = '\x1b21~';
        else if (e.key == "F6" && e.metaKey)      control_seq = '\x1b23~';
        else if (e.key == "F7" && e.metaKey)      control_seq = '\x1b24~';
        else if (e.key == "F8" && e.metaKey)      control_seq = '\x1b25~';
        else if (e.key == "F9" && e.metaKey)      control_seq = '\x1b26~';
        else if (e.key == "F10" && e.metaKey)      control_seq = '\x1b28~';
        else if (e.key == "F11" && e.metaKey)      control_seq = '\x1b29~';
        else if (e.key == "F12" && e.metaKey)      control_seq = '\x1b31~';
        else if (e.key == "F13" && e.metaKey)      control_seq = '\x1b32~';
        else if (e.key == "F14" && e.metaKey)      control_seq = '\x1b33~';
        else if (e.key == "F15" && e.metaKey)      control_seq = '\x1b34~';

        else return;

        e.preventDefault();
        return control_seq;

    }

    // add new lines or rows to the current terminal output
    public insertRawText(text: string) {
        if (!text || !(typeof text == "string")) return;

        if (this.max_loaded_row == -1) this.cursor_y++;

        //this.hidden_cursor = true;
        this.appendWithEscapeSequences(text)
        //setTimeout(()=>this.hidden_cursor = false, 20);

        // scroll to bottom
        this.scrollToBottom(true)
    }

 

    private static FOREGROUND_COLORS = {
        30: '#000000', // black
        31: UIX.Theme.colors.red, // red
        32: UIX.Theme.colors.green, // green
        33: UIX.Theme.colors.yellow, // yellow
        34: UIX.Theme.colors.blue, // blue
        35: UIX.Theme.colors.purple, // magenta
        36: UIX.Theme.colors.light_blue, // cyan
        37: '#cccccc', // light grey
        39: 'var(--text_highlight)', // default
        90: '#666666', // dark grey
        91: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.red, 0.2), // light red
        92: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.green, 0.2), // light green
        93: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.yellow, 0.2), // light yellow
        94: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.blue, 0.2), // light blue
        95: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.purple, 0.2), // light magenta
        96: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.light_blue, 0.2), // light cyan
        97: '#ffffff', // white
    }

    static BACKGROUND_COLORS = {
        40: '#000000', // black
        41: UIX.Theme.colors.red, // red
        42: UIX.Theme.colors.green, // green
        43: UIX.Theme.colors.yellow, // yellow
        44: UIX.Theme.colors.blue, // blue
        45: UIX.Theme.colors.purple, // magenta
        46: UIX.Theme.colors.light_blue, // cyan
        47: '#cccccc', // light grey
        49: 'transparent', // default
        100: '#666666', // dark grey
        101: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.red, 0.2), // light red
        102: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.green, 0.2), // light green
        103: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.yellow, 0.2), // light yellow
        104: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.blue, 0.2), // light blue
        105: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.purple, 0.2), // light magenta
        106: UIX.Utils.lightenDarkenColor(UIX.Theme.colors.light_blue, 0.2), // light cyan
        107: '#ffffff', // white
    }

    static COLORS_256:string[]

    private static match = {

        _INVALID: /^\x1b\[\?/,

        NO_ESC: /^[^\x1b\x08\x07\x0a\x0b\x0c\x0d\x9d\x9c\x1b]+/, // normal text, no control characters
        NEW_LINE: /^\n/, // \n

        DEFAULT: /^\x1b([DEHMNOPXZcgno6789=>\\^_|}~$()*+])/, // default escape sequence

        ISO_2022: /^\x1b([($.)*+][A-Z@(][A-Z]?)/, //  ISO-2022 characters sets (korean, chinese, ...)

        BEL: /^\x07/, // bell
        BS: /^\x08/, // backspace
        ST: /^\x9c/, // string terminator
        TAB: /^\x09/, // tab
        LINE_FEED_OR_NEW_LINE: /^(\x0a|\x0b|\x0c)/, // newline
        CARRIAGE_RETURN: /^\x0d/, // newline
        COLORS: /^\x1b\[((\d{0,4};)*\d{0,4})m/,

        OSC: /^(\x1b\]|\x9d)(\d{0,4};)*([^\x07\x9c]*)(\x07|\x9c|\x1b\\)/, // operating system commands
        OSC_START: /^(\x1b\]|\x9d)(\d{0,4};)*/, // operating system commands start
        OSC_END: /^(\x07|\x9c|\x1b\\)/, // operating system commands end

        CSI_DEFAULT: /^\x1b\[((\d{0,4};)*\d{0,4})?([a-zA-Z@`])/,
        CSI_SPECIAL_CHAR: /^\x1b\[([?<>=!'])((\d{0,4};)*\d{0,4})?([a-zA-Z@])/ // \e[X1;2;3Y

    }

    // all rows
    private rows:HTMLDivElement[];
    // all seperate blocks per row
    private blocks_in_row: (Map<number,{size:number, block:HTMLSpanElement}>)[];
    // remember last style
    private current_style:{[key:string]:string} = {};
    private current_classes:Set<string> = new Set();

    private max_loaded_row = -1; // no rows loaded at the beginning

    private last_inserted_content:string; // cache content to repeat characters

    private h_tab_stops = new Set<number>();
    private line_feed_mode = false;

    #cursor_x = 0;
    #cursor_y = -1; // create the first row at the start

    // cursor style
    #steady_cursor = false;
    #cursor_style:CURSOR_STYLE = CURSOR_STYLE.BLOCK; 
    #hidden_cursor = false;

    get steady_cursor() {return this.#steady_cursor;}
    get cursor_style() {return this.#cursor_style;}

    set steady_cursor(on:boolean) {
        this.#steady_cursor = on;
        if (on) this.cursor?.classList.remove("blink")
        else this.cursor?.classList.add("blink")
    }
    set cursor_style(style:CURSOR_STYLE) {
        this.#cursor_style = style;
        if (!this.cursor) return;
        if (style == CURSOR_STYLE.UNDERLINE) {
            this.cursor.innerHTML = "_";
            this.cursor.style.color = 'var(--text_highlight)';
            this.cursor.style.setProperty('backdrop-filter', 'none');
            this.cursor.style.setProperty('-webkit-backdrop-filter', 'none');
        }
        else if (style == CURSOR_STYLE.BLOCK) {
            this.cursor.innerHTML = "_";
            this.cursor.style.color = 'transparent';
            this.cursor.style.setProperty('backdrop-filter', 'invert(1)');
            this.cursor.style.setProperty('-webkit-backdrop-filter', 'invert(1)');
        }
        else if (style == CURSOR_STYLE.BAR) {
            this.cursor.innerHTML = "⎸";
            this.cursor.style.color = 'var(--text_highlight)';
            this.cursor.style.setProperty('backdrop-filter', 'none');
            this.cursor.style.setProperty('-webkit-backdrop-filter', 'none');
        }
    }

    set hidden_cursor(hidden:boolean) {
        this.#hidden_cursor = hidden;
        if (!this.cursor) return;
        if (UIX.Debug.DEBUG_MODE) {
            if (hidden) {this.cursor.style.backgroundColor = "magenta"; this.cursor.style.opacity = '0.5';}
            else {this.cursor.style.backgroundColor = ""; this.cursor.style.opacity = '1';}
        }
        else {
            if (hidden) this.cursor.style.opacity = '0';
            else this.cursor.style.opacity = '1';
        }
    }

    get hidden_cursor() {return this.#hidden_cursor};


    get current_width() {
        if (this.content.clientWidth == 0) return 1000;
        return Math.floor(this.content.clientWidth / this.cursor.clientWidth)
    }

    get current_height() {
        if (this.content.clientHeight == 0) return 1000;
        return Math.floor(this.content.clientHeight / this.cursor.clientHeight) -1;
    }

    set cursor_x(x:number) {
        if (x<0) {console.error("cannot set negative x-position: " + x);return}
        this.#cursor_x = x
        
        // cursor update
        if (this.cursor_ghost_text) this.cursor_ghost_text.innerText = '.'.repeat(x<0?0:x);
    }

    set cursor_y(y:number) {
        if (y<-1) {console.error("cannot set negative y-position: " + y);return}
        this.#cursor_y = y;
        // add rows?
        if (y>this.max_loaded_row) this.createRowDOM(y);

        // cursor update
        if(this.cursor_ghost_rows) this.cursor_ghost_rows.innerHTML = '<div class="term-row">.</div>'.repeat(y<0?0:y);
    }

    get cursor_y() {return this.#cursor_y;}
    get cursor_x() {return this.#cursor_x;}

    // save + restore cursor
    #saved_cursor: {x:number, y:number}
    saveCursor(){
        this.#saved_cursor = {x:this.cursor_x, y:this.cursor_y}
    }
    restoreCursor(){
        if (!this.#saved_cursor) return;
        this.cursor_x = this.#saved_cursor.x;
        this.cursor_y = this.#saved_cursor.y;
        this.hidden_cursor = false;
    }


    // switch between screen buffers
    #normal_screen_buffer:{text_div?:HTMLDivElement, rows?:HTMLDivElement[], blocks_in_row?:(Map<number,{size:number, block:HTMLSpanElement}>)[], max_loaded_row:number} = {rows:[], blocks_in_row:[], max_loaded_row:-1};
    #alternate_screen_buffer:{text_div?:HTMLDivElement, rows?:HTMLDivElement[], blocks_in_row?:(Map<number,{size:number, block:HTMLSpanElement}>)[], max_loaded_row:number} = {rows:[], blocks_in_row:[], max_loaded_row:-1};

    useAlternateScreenBuffer(clear=false){
        this.logger.debug("switching to alternate screen buffer")
        
        if (this.text_div) this.text_div.replaceWith(this.#alternate_screen_buffer.text_div);
        this.text_div = this.#alternate_screen_buffer.text_div;
        this.rows = this.#alternate_screen_buffer.rows;
        this.blocks_in_row = this.#alternate_screen_buffer.blocks_in_row;
        this.max_loaded_row = this.#alternate_screen_buffer.max_loaded_row;

        if (clear) this.clear();
    }
    
    useNormalScreenBuffer(clear=false){
        this.logger.debug("switching to normal screen buffer")

        if (this.text_div) this.text_div.replaceWith(this.#normal_screen_buffer.text_div);
        this.text_div = this.#normal_screen_buffer.text_div;
        this.rows = this.#normal_screen_buffer.rows;
        this.blocks_in_row = this.#normal_screen_buffer.blocks_in_row;
        this.max_loaded_row = this.#normal_screen_buffer.max_loaded_row;
        
        if (clear) this.clear();
    }

    // get current row size
    get current_row_size() {
        const blocks = this.blocks_in_row[this.cursor_y];
        const max_block_index = Math.max(...[...blocks.keys()]);
        let row_total_size = max_block_index + (blocks.get(max_block_index)?.size??0)
        if (row_total_size == -Infinity) row_total_size = 0;
        return row_total_size;
    }


    // row actions
    private createRowDOM(upto_y = this.cursor_y) {
        let start = this.max_loaded_row+1;
        // invalid max_row, recreate every missing row
        if (start>upto_y) start = 0;

        // create row at current y and any missing rows above
        for (let y = start; y<=upto_y; y++) {
            if (this.rows[y] == undefined) this._createRowDOM(y);
        }
        this.max_loaded_row = upto_y;
    }

    private _createRowDOM(y:number) {
        const row = document.createElement("div");
        row.classList.add("term-row");
        // zero-width span to get correct row height (TODO better solution?)
        const span = document.createElement("span");
        span.innerHTML = "&ZeroWidthSpace;";
        row.append(span)
        this.rows[y] = row;
        this.text_div?.append(row);

        this.blocks_in_row[y] = new Map();
    }


    private _last_open_part: string;
    private _osc_text: string
    private _osc_params: number[]

    private appendWithEscapeSequences(content:string){
        //console.log(">",content);

        // find escape sequences
        let match:RegExpMatchArray;

        // insert escape from last block
        if (this._last_open_part) {
            content = this._last_open_part + content;
            delete this._last_open_part;
        }

        while (content.length) {

            // newline
            if (match = content.match(Terminal.match.NEW_LINE)) {
                content = content.substring(match[0].length)
                this.cursor_y ++;
            }

            // normal text
            else if (match = content.match(Terminal.match.NO_ESC)) {
                content = content.substring(match[0].length)

                // is osc text
                if (this._osc_params) {
                    this._osc_text += match[0];
                }
                // normal
                else {
                    if (match[0]) this.insertContent(match[0])
                    else console.error("empty content", match)
                }

            }
         

            // Control characters
            else if (match = content.match(Terminal.match.BEL)) {
                content = content.substring(match[0].length);
                this._bell();
            }
            else if (match = content.match(Terminal.match.BS)) {
                content = content.substring(match[0].length);
                this.cursor_x --;
            }
            else if (match = content.match(Terminal.match.TAB)) {
                content = content.substring(match[0].length);
                this.cursor_x = Math.min(...[...this.h_tab_stops].filter(key=>key>this.cursor_x));
            }
            else if (match = content.match(Terminal.match.LINE_FEED_OR_NEW_LINE)) {
                content = content.substring(match[0].length);
                if (this.line_feed_mode) this.insertRawText("\n") // newline mode
                else this.cursor_x = 0; // linefeed mode
            } 
            else if (match = content.match(Terminal.match.CARRIAGE_RETURN)) {
                content = content.substring(match[0].length);
                this.cursor_x = 0; // carriage return
            }

               
            // \e[X1;2;3Y
            else if (match = content.match(Terminal.match.CSI_SPECIAL_CHAR)) {
                content = content.substring(match[0].length)
                let special_char =  match[1]
                let type = match[4];
                let params = match[2]?.split(";").map((i:string)=>parseInt(i)||0) ?? [];
                
                if (special_char == "?") {
                    switch (type) {
                        case 'J':  // selective erase in display
                            // clear from cursor to beginning of the display
                            if (params[0] == 1) {
                                this._deleteRangeInRow(0, this.cursor_x);this.cursor_x = 0;
                                this._deleteRows(0, this.cursor_y);
                            }
                            // clear complete display
                            else if (params[0] == 2) this.clear()
                            // clear from cursor to the end of the display
                            else {
                                this._deleteRangeInRow(this.cursor_x, Infinity)
                                this._deleteRows(this.cursor_y+1, Infinity);
                            };
                            break;
                        case 'K': // Erase in line
                            // clear from cursor to beginning of the line
                            if (params[0] == 1) {
                                this._deleteRangeInRow(0, this.cursor_x);this.cursor_x = 0;
                            }
                            // clear entire line
                            else if (params[0] == 2) {
                                this._deleteRangeInRow(0, Infinity);this.cursor_x = 0;
                            } 
                            // clear from cursor to the end of the line
                            else this._deleteRangeInRow(this.cursor_x, Infinity)
                            break;
                        
                        case 'h': // SET DEC/xterm specific mode
                            switch (params[0]) {
                                case 1: this.normal_cursor_keys = false;break; // Application Cursor Keys (DECCKM)
                                case 25: this.hidden_cursor = false;break;
                                case 67: this.resources.backarrowKey = true; break; // Backarrow key sends backspace (DECBKM)
                                case 1047: this.useAlternateScreenBuffer();break; // Use Alternate Screen Buffer, xterm
                                case 1048: this.saveCursor();break; // Save cursor as in DECRC, xterm
                                case 1049: this.saveCursor();this.useAlternateScreenBuffer(true);break; // Save cursor as in DECSC, xterm.  After saving the cursor, switch to the Alternate Screen Buffer,clearing it first
                                case 2004: this.bracketed_paste_mode = true; break; // Set bracketed paste mode, xterm.
                                default: this.logger.debug("Missing DEC/xterm mode implementation: " + params[0])
                            }
                            break;
                        case 'l': // RESET DEC/xterm specific mode
                            switch (params[0]) {
                                case 1: this.normal_cursor_keys = true;break; // Normal Cursor Keys (DECCKM)
                                case 25: this.hidden_cursor = true;break; // Hide cursor (DECTCEM), VT220
                                case 30: console.log("TODO hide scrollbar"); break; // Don't show scrollbar
                                case 67: this.resources.backarrowKey = false; break; // Backarrow key sends delete (DECBKM)
                                case 1047: this.useNormalScreenBuffer();break; // Use Normal Screen Buffer, xterm
                                case 1048: this.restoreCursor();break; // Restore cursor as in DECRC, xterm
                                case 1049: this.useNormalScreenBuffer();this.restoreCursor();break; // Use Normal Screen Buffer and restore cursor as in DECRC, xterm
                                case 2004: this.bracketed_paste_mode = false; break; // Reset bracketed paste mode, xterm.
                                default: this.logger.debug("Missing DEC/xterm mode implementation: " + params[0])
                            }
                            break;
                        case 'c':
                            this.logger.debug("report device attributes");
                            break;
                        default:
                            this.logger.debug("Missing CSI special char " + type);
                    }
                }

                else if (special_char == "!") {
                    if (type == 'p') this.clear()// soft reset
                    else this.logger.debug("unhandled", match[0])
                }

                else if (special_char == ">") {
                    if (type == 'K') {
                        if (params[0] == 3) this._deleteRangeInRow(params[1], params[2], false, true) // Erase characters from x1 column through x2 column.
                    }
                    else if (type == 'm') {
                        if (params[0] == 0) this.resources.modifyKeyboard = params[1]??0;
                        else if (params[0] == 1) this.resources.modifyCursorKeys = params[1]??0;
                        else if (params[0] == 2) this.resources.modifyFunctionKeys = params[1]??0;
                        else if (params[0] == 3) this.resources.modifyOtherKeys = params[1]??0;
                    }
                    else if (type == 'n') {
                        if (params[0] == 0) this.resources.modifyKeyboard = -1;
                        else if (params[0] == 1) this.resources.modifyCursorKeys = -1;
                        else if (params[0] == 2) this.resources.modifyFunctionKeys = -1;
                        else if (params[0] == 3) this.resources.modifyOtherKeys = -1;
                        else this.resources.modifyFunctionKeys = -1;
                    }
                    else this.logger.debug("unhandled", match[0])
                }
            }
            
            // \e[1;2;3X
            else if (match = content.match(Terminal.match.CSI_DEFAULT)) {
                content = content.substring(match[0].length)

                let type = match[3];
                let params = match[1]?.split(";").map((i:string)=>parseInt(i)||0) ?? [];
        
                // Change style
                if (type == "m") {            
                    this._updateStyle(params);
                }
    
                // status report
                else if (type == "n") { 
                    // send OK    
                    if (params[0] == 5) this.send('\x1b[0n');
                    // send cursor position row;column
                    else if (params[0] == 6) this.send(`\x1b[${this.cursor_y+1};${this.cursor_x+1}R`)
                }

                // set cursor style
                else if (type == " q") { 
                    switch (params[0]) {
                        case 0: this.steady_cursor = false; this.cursor_style = CURSOR_STYLE.BLOCK; break; // blinking block
                        case 1: this.steady_cursor = false; this.cursor_style = CURSOR_STYLE.BLOCK; break; // blinking block
                        case 2: this.steady_cursor = true; this.cursor_style = CURSOR_STYLE.BLOCK; break; // steady block
                        case 3: this.steady_cursor = false; this.cursor_style = CURSOR_STYLE.UNDERLINE; break; // blinking underline
                        case 4: this.steady_cursor = true; this.cursor_style = CURSOR_STYLE.UNDERLINE; break; // steady underline
                        case 4: this.steady_cursor = false; this.cursor_style = CURSOR_STYLE.BAR; break; // steady bar
                        case 4: this.steady_cursor = true; this.cursor_style = CURSOR_STYLE.BAR; break; // steady bar

                    }
                }

                // Erase in display
                else if (type == "J") {
                     // clear from cursor to beginning of the display
                     if (params[0] == 1) {
                        this._deleteRangeInRow(0, this.cursor_x);this.cursor_x = 0;
                        this._deleteRows(0, this.cursor_y);
                    }
                    // clear complete display
                    else if (params[0] == 2) this.clear()
                    // clear from cursor to the end of the display
                    else {
                        this._deleteRangeInRow(this.cursor_x, Infinity)
                        this._deleteRows(this.cursor_y+1, Infinity);
                    }
                }

                // Erase in line
                else if (type == "K") {
                    // clear from cursor to beginning of the line
                    if (params[0] == 1) {
                        this._deleteRangeInRow(0, this.cursor_x, false, true);
                    }
                    // clear entire line
                    else if (params[0] == 2) {
                        this._deleteRangeInRow(0, Infinity);
                    }
                    // clear from cursor to the end of the line
                    else {
                        this._deleteRangeInRow(this.cursor_x, Infinity)
                    }
                }

                // Move cursor
                else if (type == "A") this.cursor_y -= params[0]??1 // up
                else if (type == "B") this.cursor_y += params[0]??1 // down
                else if (type == "C" || type == "a") this.cursor_x += params[0]??1 // right
                else if (type == "D") this.cursor_x -= params[0]??1 // left
                else if (type == "a") this.cursor_x += params[0]??1 // right
                else if (type == "d") this.cursor_y = (params[0]==undefined) ? 0 : params[0]-1; // current column, set row
                else if (type == "e") this.cursor_y += params[0]??0 // move down x rows
                else if (type == "f") { // set row, colum
                    this.cursor_y = (params[0]==undefined) ? 0 : params[0]-1; // cursor_y = 0 <=> 1
                    this.cursor_x = (params[1]==undefined) ? 0 : params[1]-1;
                }
                else if (type == "g") { // clear tab stops
                    if (params[0] == 3) {this.h_tab_stops.clear()} // clear all
                    else this.h_tab_stops.delete(this.cursor_x); // clear tab stop at current x
                }
                else if (type == "j") this.cursor_x -= params[0]??1 // move to left x columns
                else if (type == "k") this.cursor_y -= params[0]??1 // move up y columns

                else if (type == "`") this.cursor_x = (params[0]==undefined) ? 0 : params[0]-1; // current row, set colum

                // insert x blank characters (dont move cursor?)
                else if (type == "@") {
                    this.insertContent(" ".repeat(params[0]??1), false, false);
                }
                // insert x blank lines
                else if (type == "L") this.insertRawText("\n".repeat(params[0]??1))
                // delete x lines
                else if (type == "M") this._deleteRows(this.cursor_y+1, this.cursor_y+1+(params[0]??1));
                // delete x characters to the right of cursor
                else if (type == "P") this._deleteRangeInRow(this.cursor_x+1, this.cursor_x+1+(params[0]??1), true);
                // erase x characters to the right of cursor
                else if (type == "X") this._deleteRangeInRow(this.cursor_x+1, this.cursor_x+1+(params[0]??1), false);
                // newline x times
                else if (type == "E") {this.cursor_x = 0; this.cursor_y += (params[0]??1)}
                // newline reverse x times
                else if (type == "F") {this.cursor_x = 0; this.cursor_y -= (params[0]??1)}
                // x-th column of current line
                else if (type == "G") {this.cursor_x = (params[0]==undefined) ? 0 : params[0]-1;}
          
                // set cursor position
                else if (type == "H") {
                    this.cursor_y = (params[0]==undefined) ? 0 : params[0]-1;
                    this.cursor_x = (params[1]==undefined) ? 0 : params[1]-1;
                }

                // SET standard modes
                else if (type == "h") {
                    switch (params[0]) {
                        case 20: this.line_feed_mode = true;break; // set linefeed mode to newline
                        case 33: this.steady_cursor = true;break; // steady cursor
                        case 34: this.cursor_style = CURSOR_STYLE.UNDERLINE;break; // underline cursor
                    }
                }
                // RESET standard modes
                else if (type == "l") {
                    switch (params[0]) {
                        case 20: this.line_feed_mode = false;break; // set linefeed mode to newline
                        case 33: this.steady_cursor = false;break; // blinking cursor
                        case 34: this.cursor_style = CURSOR_STYLE.BLOCK;break; // block cursor

                    }
                }

                // save cursor position
                else if (type == "s") {
                    this.saveCursor()
                }

                // restore cursor position
                else if (type == "u") {
                    this.restoreCursor()
                }

                // Window manipulation
                else if (type == "t") {
                    // De-iconify window
                    if (params[0] == 1) this.logger.debug("De-iconify window")                        
                    // Iconify window
                    if (params[0] == 2) this.logger.debug("Iconify window")
                    // move window x ; y           
                    if (params[0] == 3) this.logger.debug("Move window to", params[1], params[2])           
                    // resize window height ; width 
                    if (params[0] == 3) this.logger.debug("Resize window to", params[1], params[2])                         
                    // move to front
                    if (params[0] == 5) this.logger.debug("Move window to front")
                    // move to back
                    if (params[0] == 6) this.logger.debug("Move window to back")
                    // refresh
                    if (params[0] == 7) this.logger.debug("Refresh window")
                    // resize text area height ;  width 
                    if (params[0] == 8) this.logger.debug("Resize text area", params[1], params[2])
                    // maximize...
                    if (params[0] == 9) this.logger.debug("Window maximize");
                    // fullscreen...
                    if (params[0] == 10) this.logger.debug("Window fullscreen");

                }

                // scrolling areas
                else if (type == "r") {

                    // also move cursor to 0,0
                    this.cursor_x = 0;
                    this.cursor_y = 0;
                }
                
                // repeat preceding character
                else if (type == "b") {
                    this.insertContent(this.last_inserted_content[this.last_inserted_content.length-1].repeat(params[0]??0));
                }
                

                else {
                    console.log("unknown esc seq", type, match[0]);
                }
            }

            // ESC]1;2;...ST
            else if (match = content.match(Terminal.match.OSC)) {
                content = content.substring(match[0].length)

                let text = match[3];
                let params = match[2]?.split(";").map((i:string)=>parseInt(i)||0) ?? [];

                this._handleOSC(text, params);
            }

            // ISO-2022 TODO
            else if (match = content.match(Terminal.match.ISO_2022)) {
                content = content.substring(match[0].length);
                let type = match[1];
                //console.log("ISO-2022: " + match[1]);
            }

            else if (match = content.match(Terminal.match.DEFAULT)) {
                content = content.substring(match[0].length);
                let type = match[1];
                
                // set tab_stop to current column
                if (type == "H") this.h_tab_stops.add(this.cursor_x);
                // linefeed
                else if (type == "D") this.cursor_y ++;
                // reverse linefeed
                else if (type == "M") this.cursor_y --;
                // cursor back 1 column (TODO If the cursor is at the left margin, then all screen data within the margins moves one column to the right. The column shifted past the right margin is lost.)
                else if (type == "6") this.cursor_x --;
                // cursor forward 1 column
                else if (type == "9") this.cursor_x ++;
                // cursor first position in next line
                else if (type == "E") {this.cursor_x=0; this.cursor_y++}
                // visible bell
                else if (type == "g") this._bell()
                // full reset
                else if (type == "c") this.clear()
                // application keypad
                else if (type == "=") this.normal_keypad = false // Application Keypad (DECKPAM)
                // normal keypad
                else if (type == ">") this.normal_keypad = true
                // save cursor
                else if (type == "7") this.saveCursor()
                // restore cursor
                else if (type == "8") this.restoreCursor()
                else console.log("unknown default esc seq", match[0]);
            }

// TODO INVALID ESC ???!? 
            else if (match = content.match(Terminal.match._INVALID)) {
                content = content.substring(match[0].length);
                console.error("INVALID ESC SEQUENCE: " + match[0]);
            }

            // unmatched part
            else {
                //console.log("unmatched content: '" +  content + "'");
                this._last_open_part = content;
                break;
            }

        }
       
    }

    private _handleOSC(text:string, params:number[]) {
        switch (params[0]) {
            case 0: this._setIconName(text);this._setWindowTitle(text);break;
            case 1: this._setIconName(text);break;
            case 2: this._setWindowTitle(text);break;
            case 4: this._setANSIColor(...<[string,string]>text.split(';'));break;
            case 10: this._setDynamicTextColor(text);break;
            case 5: this._setFont(text);break;
            default: console.error("Missing OSC Sequence: ", text, params);
        }
    }

    private _bell(){
        UIX.Sounds.play(UIX.Sounds.ALERT)
    }

    private _deleteRows(start:number, end:number) {
        for (let r=Math.max(start,0);r<Math.min(end,this.rows.length);r++) this.rows[r]?.remove(); // delete rows
        this.rows.splice(start, end-start);
        this.blocks_in_row.splice(start, end-start);
    }

    // delete range
    private _deleteRangeInRow(start:number, end:number, shift_behind=false, fill_empty_blocks=false) {
        let blocks = this.blocks_in_row[this.cursor_y];
        if (!blocks) {
            console.error("could not find blocks for current y position: " + this.cursor_y);
            return;
        }
        let indices = [...blocks.keys()];
        
        // negative indices ?
        if (start<0) start = this.current_row_size + start -1;
        if (end<0) end = this.current_row_size + end -1;

        // get relevant blocks
        let start_block = Math.max(...indices.filter(key => key<=start));
        let end_block = Math.max(...indices.filter(key => key<end));
        let index_after_end_block = end_block + blocks.get(end_block)?.size;

        let inbetween = (start_block==end_block) ? [] : indices.filter(key=>key>start_block&&key<end_block) // all blocks betwen start and end

        //console.warn("DELETE ", start_block, end_block, inbetween, blocks);

        // delete parts from start and end block, always shift behind (delete empty spaces)
        if (isFinite(start_block)) this.deleteBlockPart(blocks, start_block, start, end, shift_behind, fill_empty_blocks);
        if (isFinite(end_block) && end_block != start_block) this.deleteBlockPart(blocks, end_block, start, end, shift_behind, fill_empty_blocks);
        
        // delete all inbetween blocks only if shift/not fill empty blocks, or erase
        for (let i of inbetween) (shift_behind||!fill_empty_blocks) ? this.deleteBlock(blocks, i) : this.eraseBlock(blocks, i);
        
        // update indices for all shifted blocks after the end block
        let shift = start - end;
        if (isFinite(shift) && shift_behind) {
            // move end block index to start of cutout
            if (start_block !== end_block) this.setBlockIndex(start, end_block);
            // shift all blocks after the end block to fill the gap
            if (isFinite(index_after_end_block)) this.shiftBlocks(shift, index_after_end_block)
        }

        // !shift_behind <=> keep gap:
        if (!shift_behind) {
            // fix index of start block to new position -> move right to keep gap:  
            // OO XXXOO OO
            //    | start block
            if (start_block == start) {
                this.setBlockIndex(start_block-shift, start_block) // (but start block might no longer exist if completely deleted)
            }
            // fix index of end block
            if (end_block != start_block) {
                this.setBlockIndex(end, end_block)
            }
            // all blocks inbetween are irrelevant because they are deleted anyways
        }
       
    }

    private insertAfter(newNode:Node, existingNode:Node) {
        existingNode.parentNode.insertBefore(newNode, existingNode.nextSibling);
    }

    // update indices, does not change DOM unless a block with the shift size is added before!
    private shiftBlocks(shift_by:number, start_from_index = 0) {
        let blocks = this.blocks_in_row[this.cursor_y];
        let indices = [...blocks.keys()].filter(key=>key>=start_from_index).sort();
        if (shift_by>0) indices = indices.reverse() // left -> right, loop in reverse order
        for (let index of indices) {
            if (!blocks.has(index)) continue;
            blocks.set(index+shift_by, blocks.get(index));
            blocks.delete(index);
        }
        
    }
    private setBlockIndex(new_index:number, index = 0) {
            let blocks = this.blocks_in_row[this.cursor_y];
            if (!blocks.has(index)) return;
            blocks.set(new_index, blocks.get(index));
            blocks.delete(index);
    }

    // shift content right to index
    private shiftContent(shift_by:number, start_from_index = 0) {
        let blocks = this.blocks_in_row[this.cursor_y];

        let split_block_i = Math.max(...[...blocks.keys()].filter(key=>key<=start_from_index));
        if (!isFinite(split_block_i)) console.error("infitie split")
        // is split a edge of block? just shift blocks
        else if (split_block_i == start_from_index) this.shiftBlocks(shift_by, start_from_index);
        // split block
        else {
            let split_block = blocks.get(split_block_i);
            let content = split_block.block.innerText;
            // keep first part
            let c1 = content.substring(0, start_from_index-split_block_i);
            split_block.block.innerText = c1;
            split_block.size = c1.length;
            // create new block for second part, insert
            let c2 = content.substring(start_from_index-split_block_i);
            let block_2 = <HTMLSpanElement>split_block.block.cloneNode();
            block_2.innerText = c2;
            this.insertAfter(block_2, split_block.block)

            // now shift other blocks
            this.shiftBlocks(shift_by, start_from_index+content.length)

            // also add + shift the new block
            blocks.set(start_from_index+shift_by, {size: c2.length, block: block_2});
        }
    }

    // delete block, does not shift other blocks
    private deleteBlock(blocks:Map<number,{size: number,block: HTMLSpanElement}>, index:number,){
        let block = blocks.get(index);
        blocks.delete(index);
        block.block.remove();
    }

    // set all " "
    private eraseBlock(blocks:Map<number,{size: number,block: HTMLSpanElement}>, index:number,){
        let block = blocks.get(index);
        block.block.innerText = " ".repeat(block.size);
    }

    // cuts out a section from a block (might replace with spaces, if cutout inside block)
    private deleteBlockPart(blocks:Map<number,{size: number,block: HTMLSpanElement}>, index:number, start:number, end:number, shift_behind = false, fill_empty_blocks = true){
        let block = blocks.get(index);
        let block_start = index;
        let block_end = index + block.size;

        // even inside block?
        //console.log(block_start, block_end, start, end);
        if (block_start>=end || block_end<=start) {
            return; // ignore
        }

        let offset_left = start-block_start; // positive offset from start before part starts
        let offset_right = block_end-end;  // positive offset to end after part ends

        // get current content
        let block_content = block.block.innerText;

        // delete complete block (part is biggger than the block itself)
        if (offset_left<=0 && offset_right<=0) this.deleteBlock(blocks, index);
        
        // shift blocks / contents
        else if (shift_behind) {
            block_content = block_content.substring(0, offset_left) + block_content.substring(block_content.length-offset_right, block_content.length);
            block.block.innerText = block_content;
            block.size = block_content.length;
        }
        // don't change any content positions
        else {
            if (fill_empty_blocks) { // fill with spaces
                block_content = block_content.substring(0, offset_left) + " ".repeat(block_content.length-(offset_left<0?0:offset_left)-(offset_right<0?0:offset_right)) + block_content.substring(block_content.length-offset_right, block_content.length);
                block.block.innerText = block_content;
            }

            // create two blocks
            else {
               
                // second block, because this is already the last block with the cutout?
                if (end < block_end) {
                    let c2 = block_content.substring(block_content.length-offset_right, block_content.length);
                    let block_2 = <HTMLSpanElement>block.block.cloneNode();
                    block_2.innerText = c2;
                    this.insertAfter(block_2, block.block)

                    blocks.set(end, {size: c2.length, block: block_2});
                }
             
                // first block
                if (offset_left > 0) {
                    let c1 = block_content.substring(0, offset_left);
                    block.block.innerText = c1;
                    block.size = c1.length;
                }
                // delete first block
                else {
                    this.deleteBlock(blocks, block_start);
                }
            }
        
        }
        
    }
    

    // completely reset state
    public reset() {
        this.current_style = {};
        this.current_classes.clear();
        this.clear();
    }

    // clear all
    public clear(){
        this.blocks_in_row  = [];
        this.rows = [];
        this.max_loaded_row = -1;
        this.text_div.innerHTML = "";
        this.cursor_x = 0;
        this.cursor_y = 0;
    }

    // set icon name   
    private _setIconName(name:string){}
    private _setWindowTitle(name:string){}
    private _setANSIColor(num:string, color:string){}
    private _setDynamicTextColor(color:string){}
    private _setFont(font:string){}

    // update style
    private _updateStyle(params:number[]) {

        if (!params || params.length == 0) params = [0]; // reset as default

        for (let i=0; i<params.length; i++) {
            let p = params[i];

            switch (p) { 
                // reset all
                case 0:  
                    delete this.current_style.color;
                    delete this.current_style.background;
                    delete this.current_style['font-weight'];
                    delete this.current_style['font-style'];
                    delete this.current_style['border-bottom'];
                    delete this.current_style['text-decoration'];
                    delete this.current_style['__invert'];
                    delete this.current_style['opacity'];
                    this.current_classes.clear();
                    break;

                case 1:  // bold
                    this.current_style['font-weight'] = 'bold';
                    // if (!this.current_style.color || this.current_style.color == 'var(--text)') {
                    //     this.current_style.color =  'var(--text_highlight)'
                    // }
                    break;
                case 2: this.current_style['opacity'] = '0.6'; break; // dim text
                case 3: this.current_style['font-style'] = 'italic'; break; // italic
                case 4: this.current_style['border-bottom'] = '2px solid'; break;// underlined
                case 5: this.current_classes.add("blink"); break; // blink
                case 7: this.current_style['__invert'] = '1';break; // inverse
                case 8: this.current_style['opacity'] = '0'; break;// hidden
                case 9: this.current_style['text-decoration'] = 'line-through'; break;// crossed-out

                case 21:  break; // reset bold
                case 22: delete this.current_style['font-weight']; this.current_style['opacity'] = '1'; break; // reset bold, dim text
                case 23: delete this.current_style['font-style']; break; // reset italic
                case 24: delete this.current_style['border-bottom']; break; // delete underlined
                case 25: this.current_classes.delete("blink"); break; // reset blink
                case 27: delete this.current_style['__invert']; break; // reset inverse
                case 28: delete this.current_style['opacity']; break;// reset hidden
                case 29: delete this.current_style['text-decoration']; break;// reset crossed-out

                // background color to default
                case 49: delete this.current_style.background;break;

                // 256 / rgb color mapping
                case 38:  // foreground
                    if (params[i+1] == 5 && params[i+2] != undefined) {
                        this.current_style.color = Terminal.COLORS_256[params[i+2]]
                        i += 2;
                    }
                    // rgb
                    else if (params[i+1] == 2 && params[i+2] != undefined && params[i+3] != undefined && params[i+4] != undefined) {
                        this.current_style.color = `rgb(${params[i+2]},${params[i+3]},${params[i+4]})`
                        i += 4;
                    }
                    break;
                case 48:  // background
                    if (params[i+1] == 5 && params[i+2] != undefined) {
                        this.current_style.background = Terminal.COLORS_256[params[i+2]]
                        i += 2;
                    }
                    // rgb
                    else if (params[i+1] == 2 && params[i+2] != undefined && params[i+3] != undefined && params[i+4] != undefined) {
                        this.current_style.background = `rgb(${params[i+2]},${params[i+3]},${params[i+4]})`
                        i += 4;
                    }
                    break;
                

                // basic colors
                default:
                    if (Terminal.FOREGROUND_COLORS[p]) this.current_style.color = Terminal.FOREGROUND_COLORS[p]
                    if (Terminal.BACKGROUND_COLORS[p]) this.current_style.background = Terminal.BACKGROUND_COLORS[p];
            }
        }
    }

    // add gap block (with spaces) to current row
    private createGapBlock(start_x:number, width:number){
        const gap_block = {size: width, block: document.createElement("span")}; 
        gap_block.block.innerText = " ".repeat(width);
        this.blocks_in_row[this.cursor_y].set(start_x, gap_block);
        return gap_block.block;
    }

    // insert content at current active position (cursor)
    private insertContent(content:string, overwrite=true, move_cursor=true) {
        
        this.last_inserted_content = content;

        // get current row + blocks
        let blocks = this.blocks_in_row[this.cursor_y]
        let row = this.rows[this.cursor_y];

        // console.log("insert", this.cursor_y, blocks, row)

        if (!blocks) {
            console.error("could not find blocks for current y position: " + this.cursor_y);
            this.createRowDOM(this.cursor_y);
            blocks = this.blocks_in_row[this.cursor_y];
            row = this.rows[this.cursor_y];
        }

        //console.log("Insert '"+content+"' in x="+this.cursor_x, overwrite);

        // overwrite previous content, shift to fill gap
        if (overwrite) this._deleteRangeInRow(this.cursor_x, this.cursor_x+content.length, false, false);
        // shift all to the right by content size
        else this.shiftContent(content.length, this.cursor_x);

        // create block
        let block = document.createElement("span");

        let custom_content = false; 
        
        // is URL, add link
        if (content.trim().startsWith("https://")) { 
            custom_content = true;
            const url = content.split(" ", 1)[0];
            
            // add link
            const link = document.createElement("a");
            link.setAttribute("href", content);
            link.innerText = url;
            link.setAttribute("target", "__blank");
            link.style.color = "inherit"
            link.style.whiteSpace = "break-spaces"
            block.appendChild(link);

            // add remaining whitespace separately
            const rest = document.createElement("span");
            rest.innerText = content.slice(url.length);
            block.appendChild(rest);
        }

        // is DATEX Pointer
        if (content.trim().startsWith("$")) {
            block.classList.add("hoverable");

            block.addEventListener("mouseenter", e => this.showPointerTooltip(block));
            block.addEventListener("mouseout", e => this.hidePointerTooltip(block));
            block.addEventListener("click", e => this.showPointerTooltipPersistent(block));
        }

        // apply style
        for (let [key, value] of Object.entries(this.current_style)) {
            // inverted color/background-color
            if ( this.current_style.__invert && (key == 'background' || key == 'color')) continue;
            // handle underline color
            else if (key == 'border-bottom' && (this.current_style.color || this.current_style.__invert)) 
                block.style.setProperty('border-bottom', value + ' ' + (this.current_style.__invert ? (this.current_style.background??'var(--bg)') : (this.current_style.color??'var(--text)')));

            else block.style.setProperty(key, value);
        }
        // invert
        if (this.current_style.__invert) {
            block.style.setProperty('color', this.current_style.background ?? 'var(--bg)');
            block.style.setProperty('background', this.current_style.color ?? 'var(--text)');
        }

        if (this.current_classes.size) block.classList.add(...this.current_classes);
        if (!custom_content) block.innerText = content;

        // insert to dom
        
        const prev_block_x = Math.max(...[...blocks.keys()].filter(key => key<this.cursor_x));
        let prev_block = blocks.get(prev_block_x); // calculate prev block again, start_block might have been deleted

        // add after prev block
        if (prev_block) {
            const end_x = (prev_block_x+prev_block.size);
            const gap = (this.cursor_x-end_x)
            // add gap block
            if (gap > 0) {
                let gap_block = this.createGapBlock(end_x, gap);
                this.insertAfter(gap_block, prev_block.block);
                this.insertAfter(block, gap_block);
            }
            // start directly after previous block
            else this.insertAfter(block, prev_block.block);
        }
        // is the only block, append to parent row and add x shift
        else {
            // add gap block
            if (this.cursor_x > 0) {
                let gap_block = this.createGapBlock(0, this.cursor_x);
                row.append(gap_block);
                this.insertAfter(block, gap_block);
            }
            // block starts at the beginning of the row
            else row.append(block);
        }

        // save block
        blocks.set(this.cursor_x, {size: content.length, block});

        if (move_cursor && this.cursor_x < this.current_width-1) this.cursor_x += content.length // implicit cursor move
        // auto wrap
        else {
            this.cursor_x = 0;
            this.cursor_y ++;
        }
    }

    onShow() {
        if (this.out_stream) this.input_div?.focus()
    }

    #pointer_tooltips = new Map<HTMLElement, Function>()
    #persistant_pointer_tooltips = new Set<HTMLElement>()

    private async showPointerTooltip(target:HTMLElement){
        if (this.#pointer_tooltips.has(target)) return; // already expanded

        const pointer_string = target.innerText.trim();
        console.log("terminal pointer hover", pointer_string);
        await datex(pointer_string);// make sure pointer is loaded; TODO: injection vulnerability

        // create new container for pointer tooltip
        const tree_view = new DatexValueTreeView({padding_left: 10, padding_top:10, padding:10, root_resource_path:"dxptr://"+Datex.Pointer.normalizePointerId(pointer_string)+"/", display_root:true, header:false, title:pointer_string}, {dynamic_size:true})
        const container = document.createElement("div");
        // container.style.width = target.offsetWidth + 'px'; //"448px";
        container.style.height = "auto";
        tree_view.anchor(container);


        // show 'tooltip'
        const bounds = target.getBoundingClientRect();
        let height = bounds.height + container.getBoundingClientRect().height/2 + 15;
        this.#pointer_tooltips.set(target, UIX.Handlers.showTooltip(container, bounds.left, bounds.top+height, 'right', false).hide)
    }

    private showPointerTooltipPersistent(target:HTMLElement){
        // now hide if persitant tooltip already exists (toggle click)
        if (this.#persistant_pointer_tooltips.has(target)) {
            this.#persistant_pointer_tooltips.delete(target);
            this.hidePointerTooltip(target)
        }
        else {
            this.showPointerTooltip(target)
            this.#persistant_pointer_tooltips.add(target)
        }
    }

    private hidePointerTooltip(target:HTMLElement){
        if (this.#persistant_pointer_tooltips.has(target)) return; // is persistant, don't hide
        this.#pointer_tooltips.get(target)?.();
        this.#pointer_tooltips.delete(target);
    }
}


Terminal.COLORS_256 = [
    Terminal.BACKGROUND_COLORS[40],
    Terminal.BACKGROUND_COLORS[41],
    Terminal.BACKGROUND_COLORS[42],
    Terminal.BACKGROUND_COLORS[43],
    Terminal.BACKGROUND_COLORS[44],
    Terminal.BACKGROUND_COLORS[45],
    Terminal.BACKGROUND_COLORS[46],
    Terminal.BACKGROUND_COLORS[47],
    Terminal.BACKGROUND_COLORS[100],
    Terminal.BACKGROUND_COLORS[101],
    Terminal.BACKGROUND_COLORS[102],
    Terminal.BACKGROUND_COLORS[103],
    Terminal.BACKGROUND_COLORS[104],
    Terminal.BACKGROUND_COLORS[105],
    Terminal.BACKGROUND_COLORS[106],
    Terminal.BACKGROUND_COLORS[107],
    '#000000','#00005f','#000087','#0000af','#0000d7','#0000ff','#005f00','#005f5f','#005f87','#005faf','#005fd7','#005fff','#008700','#00875f','#008787','#0087af','#0087d7','#0087ff','#00af00','#00af5f','#00af87','#00afaf','#00afd7','#00afff','#00d700','#00d75f','#00d787','#00d7af','#00d7d7','#00d7ff','#00ff00','#00ff5f','#00ff87','#00ffaf','#00ffd7','#00ffff','#5f0000','#5f005f','#5f0087','#5f00af','#5f00d7','#5f00ff','#5f5f00','#5f5f5f','#5f5f87','#5f5faf','#5f5fd7','#5f5fff','#5f8700','#5f875f','#5f8787','#5f87af','#5f87d7','#5f87ff','#5faf00','#5faf5f','#5faf87','#5fafaf','#5fafd7','#5fafff','#5fd700','#5fd75f','#5fd787','#5fd7af','#5fd7d7','#5fd7ff','#5fff00','#5fff5f','#5fff87','#5fffaf','#5fffd7','#5fffff','#870000','#87005f','#870087','#8700af','#8700d7','#8700ff','#875f00','#875f5f','#875f87','#875faf','#875fd7','#875fff','#878700','#87875f','#878787','#8787af','#8787d7','#8787ff','#87af00','#87af5f','#87af87','#87afaf','#87afd7','#87afff','#87d700','#87d75f','#87d787','#87d7af','#87d7d7','#87d7ff','#87ff00','#87ff5f','#87ff87','#87ffaf','#87ffd7','#87ffff','#af0000','#af005f','#af0087','#af00af','#af00d7','#af00ff','#af5f00','#af5f5f','#af5f87','#af5faf','#af5fd7','#af5fff','#af8700','#af875f','#af8787','#af87af','#af87d7','#af87ff','#afaf00','#afaf5f','#afaf87','#afafaf','#afafd7','#afafff','#afd700','#afd75f','#afd787','#afd7af','#afd7d7','#afd7ff','#afff00','#afff5f','#afff87','#afffaf','#afffd7','#afffff','#d70000','#d7005f','#d70087','#d700af','#d700d7','#d700ff','#d75f00','#d75f5f','#d75f87','#d75faf','#d75fd7','#d75fff','#d78700','#d7875f','#d78787','#d787af','#d787d7','#d787ff','#d7af00','#d7af5f','#d7af87','#d7afaf','#d7afd7','#d7afff','#d7d700','#d7d75f','#d7d787','#d7d7af','#d7d7d7','#d7d7ff','#d7ff00','#d7ff5f','#d7ff87','#d7ffaf','#d7ffd7','#d7ffff','#ff0000','#ff005f','#ff0087','#ff00af','#ff00d7','#ff00ff','#ff5f00','#ff5f5f','#ff5f87','#ff5faf','#ff5fd7','#ff5fff','#ff8700','#ff875f','#ff8787','#ff87af','#ff87d7','#ff87ff','#ffaf00','#ffaf5f','#ffaf87','#ffafaf','#ffafd7','#ffafff','#ffd700','#ffd75f','#ffd787','#ffd7af','#ffd7d7','#ffd7ff','#ffff00','#ffff5f','#ffff87','#ffffaf','#ffffd7','#ffffff','#080808','#121212','#1c1c1c','#262626','#303030','#3a3a3a','#444444','#4e4e4e','#585858','#626262','#6c6c6c','#767676','#808080','#8a8a8a','#949494','#9e9e9e','#a8a8a8','#b2b2b2','#bcbcbc','#c6c6c6','#d0d0d0','#dadada','#e4e4e4','#eeeeee'
]



@UIX.Id("SSHTerminal")
@UIX.Component<SSH_TERMINAL_OPTIONS>({
    endpoint: '@+unyt:nodes:europe:central'
})
export class SSHTerminal<O extends SSH_TERMINAL_OPTIONS = SSH_TERMINAL_OPTIONS> extends Terminal<O> {

    // @implement
    haSidOptions(){
        return !(!this.options.host || !this.options.username || !(this.options.password || this.options.private_key))
    }
    // @implement
    requiredOptionsList(){
        return {
            host: {type:"string", name:"Address"},
            port: {type:"number", name:"Port"},
            username: {type:"string", name:"Username"},
            password: {type:"string", name:"Password"},
            private_key: {type:"string", name:"Private Key"}
        }
    }


    public async onCreate() {
        await this.initConnection();
        super.onCreate();
    }


    private async initConnection() {
        // establish connection
        if(this.options.connection) console.log("---> existing ssh connection", this.options.connection);
        const connection = this.options.connection ?? await SSH.to(f(this.options.endpoint)).connect(this.options.host, this.options.port, this.options.username, this.options.password, this.options.private_key)

        // connect out/in stream
        this.out_stream = connection.in_stream;
        this.in_stream = connection.out_stream;
    }
    
}