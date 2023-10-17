
// @ts-ignore safari doesn't have monospace font per default

const color_esc_seq = /\x1b\[((?:\d+;)*\d+)?m/g

const COLORS = {
	RED: "#ea2b51",
	GREEN: "#1eda6d",
	BLUE: "#0669c1",
	YELLOW: "#ebb626",
	MAGENTA: "#c470de",
	CYAN: "#4fa9e8",
	BLACK: "#050505",
	WHITE: "#d2d2d2"
}

const COLORS_LIGHT = {
	RED: "#f8b9c6",
	GREEN: "#bcf6d4",
	BLUE: "#97ccfc",
	YELLOW: "#f9e7b9",
	MAGENTA: "#e5c1f1",
	CYAN: "#bbdef6",
	BLACK: "#6b6b6b",
	WHITE: "#ffffff"
}

const COLORS_8_BIT = [
	COLORS.BLACK,
    COLORS.RED,
    COLORS.GREEN,
   	COLORS.YELLOW,
    COLORS.BLUE,
    COLORS.MAGENTA,
    COLORS.CYAN,
    COLORS.WHITE,
	COLORS_LIGHT.BLACK,
    COLORS_LIGHT.RED,
    COLORS_LIGHT.GREEN,
   	COLORS_LIGHT.YELLOW,
    COLORS_LIGHT.BLUE,
    COLORS_LIGHT.MAGENTA,
    COLORS_LIGHT.CYAN,
    COLORS_LIGHT.WHITE,
	'#000000','#00005f','#000087','#0000af','#0000d7','#0000ff','#005f00','#005f5f','#005f87','#005faf','#005fd7','#005fff','#008700','#00875f','#008787','#0087af','#0087d7','#0087ff','#00af00','#00af5f','#00af87','#00afaf','#00afd7','#00afff','#00d700','#00d75f','#00d787','#00d7af','#00d7d7','#00d7ff','#00ff00','#00ff5f','#00ff87','#00ffaf','#00ffd7','#00ffff','#5f0000','#5f005f','#5f0087','#5f00af','#5f00d7','#5f00ff','#5f5f00','#5f5f5f','#5f5f87','#5f5faf','#5f5fd7','#5f5fff','#5f8700','#5f875f','#5f8787','#5f87af','#5f87d7','#5f87ff','#5faf00','#5faf5f','#5faf87','#5fafaf','#5fafd7','#5fafff','#5fd700','#5fd75f','#5fd787','#5fd7af','#5fd7d7','#5fd7ff','#5fff00','#5fff5f','#5fff87','#5fffaf','#5fffd7','#5fffff','#870000','#87005f','#870087','#8700af','#8700d7','#8700ff','#875f00','#875f5f','#875f87','#875faf','#875fd7','#875fff','#878700','#87875f','#878787','#8787af','#8787d7','#8787ff','#87af00','#87af5f','#87af87','#87afaf','#87afd7','#87afff','#87d700','#87d75f','#87d787','#87d7af','#87d7d7','#87d7ff','#87ff00','#87ff5f','#87ff87','#87ffaf','#87ffd7','#87ffff','#af0000','#af005f','#af0087','#af00af','#af00d7','#af00ff','#af5f00','#af5f5f','#af5f87','#af5faf','#af5fd7','#af5fff','#af8700','#af875f','#af8787','#af87af','#af87d7','#af87ff','#afaf00','#afaf5f','#afaf87','#afafaf','#afafd7','#afafff','#afd700','#afd75f','#afd787','#afd7af','#afd7d7','#afd7ff','#afff00','#afff5f','#afff87','#afffaf','#afffd7','#afffff','#d70000','#d7005f','#d70087','#d700af','#d700d7','#d700ff','#d75f00','#d75f5f','#d75f87','#d75faf','#d75fd7','#d75fff','#d78700','#d7875f','#d78787','#d787af','#d787d7','#d787ff','#d7af00','#d7af5f','#d7af87','#d7afaf','#d7afd7','#d7afff','#d7d700','#d7d75f','#d7d787','#d7d7af','#d7d7d7','#d7d7ff','#d7ff00','#d7ff5f','#d7ff87','#d7ffaf','#d7ffd7','#d7ffff','#ff0000','#ff005f','#ff0087','#ff00af','#ff00d7','#ff00ff','#ff5f00','#ff5f5f','#ff5f87','#ff5faf','#ff5fd7','#ff5fff','#ff8700','#ff875f','#ff8787','#ff87af','#ff87d7','#ff87ff','#ffaf00','#ffaf5f','#ffaf87','#ffafaf','#ffafd7','#ffafff','#ffd700','#ffd75f','#ffd787','#ffd7af','#ffd7d7','#ffd7ff','#ffff00','#ffff5f','#ffff87','#ffffaf','#ffffd7','#ffffff','#080808','#121212','#1c1c1c','#262626','#303030','#3a3a3a','#444444','#4e4e4e','#585858','#626262','#6c6c6c','#767676','#808080','#8a8a8a','#949494','#9e9e9e','#a8a8a8','#b2b2b2','#bcbcbc','#c6c6c6','#d0d0d0','#dadada','#e4e4e4','#eeeeee'
]

/**
 * these css properties are set (overwritten)
 */
const ESCAPE_SEQUENCES_SET_CSS = {
    1: {'font-weight':'bold'},
    3: {'font-style':'italic'},
	5: {'font-weight':'bold'},

	7: {'-x-invert':'invert'},
    8: {'-x-conceal':'conceal'},
	
	21: {'font-weight':''},
	23: {'font-style':''},
	25: {'font-weight':''},

    // foreground colors
    30: {'color': COLORS.BLACK},
    31: {'color': COLORS.RED},
    32: {'color': COLORS.GREEN},
    33: {'color': COLORS.YELLOW},
    34: {'color': COLORS.BLUE},
    35: {'color': COLORS.MAGENTA},
    36: {'color': COLORS.CYAN},
    37: {'color': COLORS.WHITE},
    39: {'color': 'inherit'},

	90: {'color': COLORS_LIGHT.BLACK},
    91: {'color': COLORS_LIGHT.RED},
    92: {'color': COLORS_LIGHT.GREEN},
    93: {'color': COLORS_LIGHT.YELLOW},
    94: {'color': COLORS_LIGHT.BLUE},
    95: {'color': COLORS_LIGHT.MAGENTA},
    96: {'color': COLORS_LIGHT.CYAN},
    97: {'color': COLORS_LIGHT.WHITE},

    // background colors
    40: {'background-color': COLORS.BLACK}, // background-color required for safari, background does not work
    41: {'background-color': COLORS.RED},
    42: {'background-color': COLORS.GREEN},
    43: {'background-color': COLORS.YELLOW},
    44: {'background-color': COLORS.BLUE},
    45: {'background-color': COLORS.MAGENTA},
    46: {'background-color': COLORS.CYAN},
    47: {'background-color': COLORS.WHITE},
    49: {'background-color': 'inherit'},

    100: {'background-color': COLORS_LIGHT.BLACK},
    101: {'background-color': COLORS_LIGHT.RED},
    102: {'background-color': COLORS_LIGHT.GREEN},
    103: {'background-color': COLORS_LIGHT.YELLOW},
    104: {'background-color': COLORS_LIGHT.BLUE},
    105: {'background-color': COLORS_LIGHT.MAGENTA},
    106: {'background-color': COLORS_LIGHT.CYAN},
    107: {'background-color': COLORS_LIGHT.WHITE},
} as const

/**
 * these css properties are appended to existing properties
 */
const ESCAPE_SEQUENCES_APPEND_CSS = {
	4: {'text-decoration':'underline'},
	9: {'text-decoration':'line-through'},
	53: {'text-decoration':'overline'},
}  as const

/**
 * these css properties are removed from existing properties
 */
const ESCAPE_SEQUENCES_REMOVE_CSS = {
	24: {'text-decoration':'underline'},
	29: {'text-decoration':'line-through'},
	55: {'text-decoration':'overline'},

	27: {'-x-invert':'invert'},
	28: {'-x-conceal':'conceal'},
} as const;


function parseEscSequence(style:Record<string,string>, params:number[]) {
	// rgb foreground
	if (params[0] == 38 && params[1] == 2) {
		style['color'] = `rgb(${params[2]},${params[3]},${params[4]})`;
		params.splice(0, 5)
	}
	// rgb background
	else if (params[0] == 48 && params[1] == 2) {
		style['background-color'] = `rgb(${params[2]},${params[3]},${params[4]})`
		params.splice(0, 5)
	}

	// 8-bit foreground
	else if (params[0] == 38 && params[1] == 5) {
		style['color'] = COLORS_8_BIT[params[2]]
		params.splice(0, 3)
	}
	// 8-bit background
	else if (params[0] == 48 && params[1] == 5) {
		style['background-color'] = COLORS_8_BIT[params[2]]
		params.splice(0, 5)
	}

	// reset
	else if (params[0] == 0) {
		// clear style
		Object.keys(style).forEach(key => delete style[key]);
		Object.assign(style, {});
		params.splice(0, 1)
	}

	// other escape sequences
	else if (params[0] <= 107) {			
		// set css
		const set_css = ESCAPE_SEQUENCES_SET_CSS[<keyof typeof ESCAPE_SEQUENCES_SET_CSS>params[0]];
		if (set_css) Object.assign(style, set_css)
		else {
			// append css
			const append_css = ESCAPE_SEQUENCES_APPEND_CSS[<keyof typeof ESCAPE_SEQUENCES_APPEND_CSS>params[0]];
			if (append_css) {
				const key = <keyof typeof append_css> Object.keys(append_css)[0];
				if (!style[key]?.includes(append_css[key])) {
					style[key] = style[key] ? `${style[key]} ${append_css[key]}` : append_css[key];
				}
			}
			else {
				// remove css
				const remove_css = ESCAPE_SEQUENCES_REMOVE_CSS[<keyof typeof ESCAPE_SEQUENCES_REMOVE_CSS>params[0]];
				if (remove_css) {
					const key = <keyof typeof remove_css> Object.keys(remove_css)[0];
					if (style[key]) style[key] = style[key].replace(remove_css[key], ''); // remove value from css property
				}
			}
		}
		params.splice(0, 1)
	}
}

function escapeSpecialChars(content:string) {
	return content
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");   
}

export function convertANSIToHTML(content:string){
    
	const styles:Record<string,string>[] = [];


	let first = true;

	// replace escape seq with %c
	content = escapeSpecialChars(content).replace(color_esc_seq, (x,c)=> {
		const params:number[] = !c ? [0] : c?.split(";").map(Number);
		const style = styles.length ? {...styles[styles.length-1]} : {}
		styles.push(style);

		let max = 100;
		while (params?.length && max--) {
			parseEscSequence(style, params)
		}

		// parse css
		// handle invert
		const _style = {...style};
		const invert = !!_style['-x-invert'];
		const conceal = !!_style['-x-conceal'];
		delete _style['-x-invert'];
		delete _style['-x-conceal'];

		if (conceal) {
			_style['color'] = 'transparent'
		}
		if (invert) {
			if (!_style['color']) _style['color'] = 'black'
			if (_style['text-decoration']?.includes('underline')) _style['text-decoration'] = _style['text-decoration'].replace('underline', ''); // dont show underline on inverted text
		}


		const css = Object.entries(_style).map(([key,val])=>{
			if (invert && key == 'background-color') key = 'color';
			else if (invert && key == 'color') key = 'background-color';
			return val.trim() ? `${key}:${val}`: '';
		}).join(";")

		let span = `<span style="${css}">`
		if (!first) span = '</span>' + span;
		first = false;
		return span;
	});	

	if (content.startsWith('<span')) content += '</span>';

	return `<span style='white-space: pre;font-family:Menlo,Monaco,"Courier New",monospace;line-height:1rem'>${content}</span>`
}