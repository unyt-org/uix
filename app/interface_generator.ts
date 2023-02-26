// generates typescript code for @namespace JS classes with static @expose methods
// (matching code to call the methods on another endpoint)
import { $$, Datex } from "unyt_core";


type interf = {new(...args:unknown[]):unknown};

export function generateMatchingJSValueCode(module_name:string, values: [name:string, value:unknown, valid:boolean][]){

	let code = `
/*
 This TypeScript/JavaScript interface code was auto-generated using by the UIX library.
 The external DATEX code used to generate this source code is provided without warranty of any kind.
 © ${new Date().getFullYear()} unyt.org
*/

${"import"} { Datex, datex, endpoint, property, meta, timeout, sync, sealed } from "unyt_core";
const logger = new Datex.Logger("${module_name}");

`;

	for (const [name, val, valid] of values) {
		if (!valid) code += `logger.warn('Another module tried to import "${name}", which does not exist in this module. You might need to restart the backend.');\n`
		else if (typeof val == "function" && val.constructor && (<any>val)[Datex.METADATA]) code += getJSClassCode(name, <interf>val);
		else code += getJSValueCode(module_name, name, val);
	}


	return code;
}

const implicitly_converted_primitives = new Map<string, Set<string>>().setAutoDefault(Set);
const implicitly_converted = new Map<string, Set<string>>().setAutoDefault(Set);

function getJSValueCode(module_name:string, name:string, value: any) {
	let code = "";

	const type = Datex.Type.ofValue(value)
	const is_pointer = (value instanceof Datex.Value) || !!(Datex.Pointer.getByValue(value));

	// log warning for primitive non-pointer values (cannot be converted to pointer)
	if (type.is_primitive && (!is_pointer || implicitly_converted_primitives.get(module_name)?.has(name))) {
		code += name ? `logger.warn('The export "${name}" cannot be converted to a shared value. Consider explicitly converting it to a primitive pointer using $$().');\n` : `logger.warn('The default export cannot be converted to a shared value. Consider explicitly converting it to a primitive pointer using $$().');\n`
		implicitly_converted_primitives.getAuto(module_name).add(name);
	}

	// other value -> create pointers
	else {
		if (implicitly_converted.get(module_name)?.has(name)) {
			code += name ? `logger.warn('The export "${name}" was implicitly converted to a shared pointer value. This might have unintended side effects. Consider explicitly converting it to a ${type} pointer using $$().');\n` : `logger.warn('The default export was implicitly converted to a shared pointer value. This might have unintended side effects. Consider explicitly converting it to a ${type} pointer using $$().');\n`
		}
		
		// special convertions for non-pointer values
		if (!is_pointer) {
			// convert es6 class with static properties
			if (typeof value == "function" && /^\s*class/.test(value.toString())) {
				// convert static class to normal object
				const original_value = value;
				value = {}
				for (const prop of Object.getOwnPropertyNames(original_value)) {
					if (prop != "length" && prop != "name" && prop != "prototype") {
						value[prop] = typeof original_value[prop] == "function" ? $$(Datex.Function.createFromJSFunction(original_value[prop], original_value)) : $$(original_value[prop]);
					}
				}
			}
			
			// convert Function to DATEX Function
			else if (value instanceof Function) value = Datex.Function.createFromJSFunction(value); 

			// log warning for non-pointer arrays and object
			else if (type == Datex.Type.std.Array || type == Datex.Type.std.Object) {
				code += name ? `logger.warn('The export "${name}" was implicitly converted to a shared pointer value. This might have unintended side effects. Consider explicitly converting it to a ${type} pointer using $$().');\n` : `logger.warn('The default export was implicitly converted to a shared pointer value. This might have unintended side effects. Consider explicitly converting it to a ${type} pointer using $$().');\n`
				implicitly_converted.getAuto(module_name).add(name);
			}
		}
		
		value = $$(value);
	}

	// disable garbage collection
	const ptr = <Datex.Pointer> Datex.Pointer.getByValue(value);
	if (ptr) ptr.is_persistant = true;

	const dx_type = Datex.Type.ofValue(value).root_type;

	const [ts_type, is_primitive] = DX_TS_TYPE_MAP.get(dx_type)??[];
	code += `${name =='default' ? 'export default' : 'export const ' + name + ' ='} await datex(\`${Datex.Runtime.valueToDatexStringExperimental(value)}\`)${ts_type ? (is_primitive ? ` as Datex.CompatValue<${ts_type}>` : ` as ${ts_type}`):''};\n`;
	return code;
}

function getJSClassCode(name:string, interf: interf) {

	const metadata = (<any>interf)[Datex.METADATA];
	const meta_scope_name = metadata[Datex.Decorators.NAMESPACE]?.constructor;
	let meta_endpoint = metadata[Datex.Decorators.SEND_FILTER]?.constructor;
	if (meta_endpoint == true) meta_endpoint = Datex.Runtime.endpoint; // deafult is local endpoint
	const meta_is_sync = metadata[Datex.Decorators.IS_SYNC]?.constructor;
	const meta_is_sealed = metadata[Datex.Decorators.IS_SEALED]?.constructor;
    const meta_timeout = metadata[Datex.Decorators.TIMEOUT]?.public;
    const meta_meta_index = metadata[Datex.Decorators.META_INDEX]?.public;

	let fields = "";

	// static and non-static properties
	const properties = metadata[Datex.Decorators.PROPERTY]?.public;
	// console.log("props",metadata)
	
	for (const prop of Object.keys(properties??{})) {
		// console.log((<any>interf.prototype)[prop]?.toString());
		fields += `
	@property${meta_timeout?.[prop]?` @timeout(${meta_timeout[prop]})`:''} public ${prop}() {}
`
	}

	const static_properties = metadata[Datex.Decorators.STATIC_PROPERTY]?.public;
	
	for (const prop of Object.keys(static_properties??{})) {
		// console.log((<any>interf)[prop]?.toString());
		fields += `
	@property${meta_timeout?.[prop]?` @timeout(${meta_timeout[prop]})`:''} public static ${prop}() {}
`
	}	
	

	return `
${meta_endpoint?`@endpoint("${meta_endpoint.toString()}"${meta_scope_name?`, "${meta_scope_name}"`:''})`:''}${meta_is_sync?' @sync':''}${meta_is_sync?' @sealed':''} export ${name == 'default' ? 'default ' : ''}class ${(name == 'default')?'DatexValue' : name} {
${fields}
}
`
}



export const DX_TS_TYPE_MAP = new Map<Datex.Type,[string,boolean]>([
	[Datex.Type.std.text, ["string", true]],
	[Datex.Type.std.integer, ["bigint", true]],
	[Datex.Type.std.decimal, ["number", true]],
	[Datex.Type.std.Object, ["Record<string,any>", false]],
	[Datex.Type.std.Array, ["any[]", false]],
	[Datex.Type.std.Function, ["Function", false]],
	[Datex.Type.std.Map, ["Map<any,any>", false]],
	[Datex.Type.std.Set, ["Set<any>", false]],
])