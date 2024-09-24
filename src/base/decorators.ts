import { Datex, handleClassDecoratorWithOptionalArgs } from "datex-core-legacy/mod.ts";
import { handleClassDecoratorWithArgs, handleClassFieldDecoratorWithOptionalArgs } from "datex-core-legacy/js_adapter/decorators.ts";
import { getCloneKeys, Component } from "../components/Component.ts";
import { getCallerFile } from "datex-core-legacy/utils/caller_metadata.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { getTransformWrapper } from "../uix-dom/datex-bindings/transform-wrapper.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { Class, Decorators } from "datex-core-legacy/datex_all.ts";
import { Path } from "datex-core-legacy/utils/path.ts";


type ComponentClass = 
	typeof Component & 
	(new (...args: unknown[]) => unknown) &  // fix abstract class
	{_init_module: string, _module: string, _use_resources: boolean} // access protected properties

const transformWrapper = getTransformWrapper(domUtils, domContext)

export function initDefaultOptions<T extends Record<string, unknown>>(url:string, componentClass: ComponentClass, defaultOptions?:Partial<Datex.DatexObjectPartialInit<T>>) {
	url = Object.hasOwn(componentClass, "_init_module") ?
		componentClass._init_module :
		url;

	if (!url) {
		console.log(new Error().stack)
		throw new Error("Could not get the location of the UIX component '"+componentClass.name+"'. This should not happen");
	}

	if (componentClass.prototype instanceof Component) {

		// set auto module (url from stack trace), not if module === null => resources was disabled with @NoResources
		if (url && componentClass._module !== null) componentClass._module = url;
		// default value of _use_resources is true (independent of parent class), if it was not overriden for this Component with @NoResources
		if (!Object.hasOwn(componentClass, '_use_resources')) componentClass._use_resources = true;

		// preload css files
		componentClass.preloadStylesheets?.();

		const name = String(componentClass.name).split(/([A-Z][a-z]+)/).filter(t=>!!t).map(t=>t.toLowerCase()).join("-"); // convert from CamelCase to snake-case

		const datex_type = Datex.Type.get("std", "uix", name);

		// js module reference
		if (client_type == "deno") {
			datex_type.jsTypeDefModule = url;
		}

		// create template class for component
		const new_class = Datex.createTemplateClass(componentClass, datex_type, true) as ComponentClass;

		// Object.defineProperty(componentClass, Datex.DX_TYPE, {set:(v)=>{console.log("set",v,new Error().stack)}, get:()=>datex_type});

		componentClass[Datex.DX_TYPE] = datex_type;

		const html_interface = Datex.Type.get('html').interface_config!;
		datex_type.interface_config.cast_no_tuple = html_interface.cast_no_tuple; // handle casts from object
		
		Object.assign(datex_type.interface_config, transformWrapper)
		

		datex_type.interface_config.serialize = (value) => {


			// serialize html part (style, attr, content)
			const html_serialized = <Record<string,any>> html_interface.serialize!(value);

			// add additional properties (same as in Datex.Runtime.serializeValue)
            const pointer = Datex.Pointer.getByValue(value)
            for (const key of datex_type.visible_children){
				if (!html_serialized.p) html_serialized.p = {};
				html_serialized.p[key] = pointer?.shadow_object?.[key] ?? value[key];
            }

			return html_serialized;
		}

		// define custom DOM element after everything is initialized
		domContext.customElements.define("uix-" + name, componentClass as typeof HTMLElement)
		return new_class
	}
	else throw new Error("Invalid @defaultOptions - class must extend Component")
}

/**
 * @NoResources: disable external resource loading (.css, .dx), must be located below the @defaultOptions decorator
 */
export function NoResources(value: typeof Component, context: ClassDecoratorContext) {
	// was called after @Component
	if (Object.hasOwn(value, '_module')) {
		throw new Error("Please put the @NoResources decorator for the component '"+context.name+"' below the @defaultOptions decorator");
	}
	(value as ComponentClass)._use_resources = false;
}


export const ID_PROPS: unique symbol = Symbol("ID_PROPS");
export const CONTENT_PROPS: unique symbol = Symbol("CONTENT_PROPS");
export const CHILD_PROPS: unique symbol = Symbol("CHILD_PROPS");
export const LAYOUT_PROPS: unique symbol = Symbol("LAYOUT_PROPS");
export const IMPORT_PROPS: unique symbol = Symbol("IMPORT_PROPS");
export const STANDALONE_PROPS: unique symbol = Symbol("STANDALONE_PROPS");
export const ORIGIN_PROPS: unique symbol = Symbol("ORIGIN_PROPS");

/** \@id to automatically assign a element id to a component property */
export function id(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function id(value: undefined, context: ClassFieldDecoratorContext): void
export function id(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		Decorators.setMetadata(context, ID_PROPS, id ?? context.name);
	})
}


/** \@content to automatically assign a element id to a component property and add element to component content (#content) */
export function content(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function content(value: undefined, context: ClassFieldDecoratorContext): void
export function content(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		Decorators.setMetadata(context, CONTENT_PROPS, id ?? context.name);
	})
}


/** @layout to automatically assign a element id to a component property and add element to component content container layout (#layout) */
export function layout(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function layout(value: undefined, context: ClassFieldDecoratorContext): void
export function layout(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		Decorators.setMetadata(context, LAYOUT_PROPS, id ?? context.name);
	})
}


/** \@child to automatically assign a element id to a component property and add element as a component child */
export function child(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function child(value: undefined, context: ClassFieldDecoratorContext): void
export function child(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		Decorators.setMetadata(context, CHILD_PROPS, id ?? context.name);
	})
}

/** \@include to bind static properties */
export function include(resource?:string, export_name?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function include(value: undefined, context: ClassFieldDecoratorContext): void
export function include(value: undefined|string, context?: ClassFieldDecoratorContext|string) {
	// resolve relative resource path
	if (typeof value == "string" && !Path.pathIsURL(value)) value = new Path(value, getCallerFile()).toString();
	return handleClassFieldDecoratorWithOptionalArgs([value, context as string], context as ClassFieldDecoratorContext, 
		([resource, export_name], context) => {
			Decorators.setMetadata(context, IMPORT_PROPS, [resource, export_name??context.name]);
		}
	)
}

type frontendClassDecoratorOptions = {
	inheritedFields?: string[]
}

/** 
 * \@frontend 
 * Exposes all methods of the class to the frontend context.
 */
export function standalone(value: Class, context: ClassDecoratorContext): void
/** 
 * \@frontend 
 * Exposes all methods of the class to the frontend context.
 * Optionally inherited properties and methods that should be exposed to the frontend can be specified.
 */
export function standalone(options: frontendClassDecoratorOptions): (value: Class, context: ClassDecoratorContext) => void
/** 
 * \@frontend 
 * Exposes the property or method to the frontend context.
 */
export function standalone(_value: undefined|((...args:any[])=>any), context: ClassFieldDecoratorContext|ClassMethodDecoratorContext): void
export function standalone(_value: undefined|Class|((...args:any[])=>any)|frontendClassDecoratorOptions, context?: ClassDecoratorContext|ClassFieldDecoratorContext|ClassMethodDecoratorContext): any {
	// class decorator
	if (!context || context.kind == "class") {
		return handleClassDecoratorWithOptionalArgs(
			[_value as frontendClassDecoratorOptions|undefined], 
			_value as Class, 
			context as ClassDecoratorContext, 
			([options], value, context) => {
				for (const prop of [...Object.getOwnPropertyNames(value.prototype), ...options?.inheritedFields??[]]) {
					if (prop == "constructor") continue;
					Decorators.setMetadata({...(context as unknown as ClassFieldDecoratorContext), kind:"field",name:prop}, STANDALONE_PROPS, prop);
				}
			}
		)
	}
	// field/method decorator
	else {
		Decorators.setMetadata(context!, STANDALONE_PROPS, context!.name);
	}
}

// TODO: @frontend decorator for functions (equivalent to :frontend attributes)


/** @bindOrigin to declare methods that work in a standlone context, but are executed in the original context */
export function bindOrigin(options:{datex:boolean}): (value: undefined, context: ClassFieldDecoratorContext|ClassMethodDecoratorContext) => void
export function bindOrigin(value: undefined, context: ClassFieldDecoratorContext|ClassMethodDecoratorContext): void
export function bindOrigin(options:{datex:boolean}|undefined, context?: ClassFieldDecoratorContext|ClassMethodDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([options], context as ClassFieldDecoratorContext, 
		([options], context:ClassFieldDecoratorContext|ClassMethodDecoratorContext) => {
			Decorators.setMetadata(context, STANDALONE_PROPS, context.name);
			Decorators.setMetadata(context, ORIGIN_PROPS, options ?? {datex:false});
		}
	)
}