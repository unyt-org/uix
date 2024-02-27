import { Datex } from "datex-core-legacy/mod.ts";
import { handleClassDecoratorWithArgs, handleClassFieldDecoratorWithOptionalArgs } from "datex-core-legacy/js_adapter/decorators.ts";
import { getCloneKeys, Component } from "../components/Component.ts";
import { getCallerFile } from "datex-core-legacy/utils/caller_metadata.ts";
import { domContext, domUtils } from "../app/dom-context.ts";
import { getTransformWrapper } from "../uix-dom/datex-bindings/transform-wrapper.ts";
import { client_type } from "datex-core-legacy/utils/constants.ts";

/**
 * @defaultOptions to define component default options
 */
export function defaultOptions<T extends Record<string, unknown>>(defaultOptions:Partial<Datex.DatexObjectPartialInit<T>>): (value: typeof Component, context: ClassDecoratorContext)=>void {
	const url = getCallerFile(); // TODO: called even if _init_module set
	return handleClassDecoratorWithArgs([defaultOptions], ([defaultOptions], value, context) => {
		console.log("@defaultOptions",defaultOptions, value,context)
		return _defaultOptions(url, value as unknown as ComponentClass, defaultOptions)
	})
}

type ComponentClass = 
	typeof Component & 
	(new (...args: unknown[]) => unknown) &  // fix abstract class
	{_init_module: string, _module: string, _use_resources: boolean} // access protected properties

const transformWrapper = getTransformWrapper(domUtils, domContext)

function _defaultOptions<T extends Record<string, unknown>>(url:string, componentClass: ComponentClass, defaultOptions?:Partial<Datex.DatexObjectPartialInit<T>>) {
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

		const name = String(componentClass.name).replace(/1$/,'').split(/([A-Z][a-z]+)/).filter(t=>!!t).map(t=>t.toLowerCase()).join("-"); // convert from CamelCase to snake-case

		const datex_type = Datex.Type.get("std", "uix", name);
		const options_datex_type = Datex.Type.get("uixopt", name);

		// js module reference
		if (client_type == "deno") {
			datex_type.jsTypeDefModule = url;
		}

		// create template class for component
		const new_class = Datex.createTemplateClass(componentClass, datex_type, true) as ComponentClass;

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
                html_serialized.p[key] = pointer?.shadow_object ? pointer.shadow_object[key]/*keep references*/ : value[key];
            }

			return html_serialized;
		}

		// component default options

		new_class.DEFAULT_OPTIONS = Object.create(Object.getPrototypeOf(new_class).DEFAULT_OPTIONS ?? {});
		if (!defaultOptions) defaultOptions = {};
		// set default options + title
		// ! title is overriden, even if a parent class has specified another default title
		// if (!(<Components.Base.Options>params[0]).title)(<Components.Base.Options>params[0]).title = component_class.name;
		Object.assign(new_class.DEFAULT_OPTIONS, defaultOptions)

		// find non-primitive values in default options (must be copied)
		new_class.CLONE_OPTION_KEYS = getCloneKeys(new_class.DEFAULT_OPTIONS);

		// create DATEX type for options (with prototype)
		options_datex_type.setJSInterface({
			prototype: new_class.DEFAULT_OPTIONS,

			proxify_children: true,
			is_normal_object: true,
		})
		// define custom DOM element after everything is initialized
		domContext.customElements.define("uix-" + name, componentClass as typeof HTMLElement)
		return new_class
	}
	else throw new Error("Invalid @defaultOptions - class must extend or Component")
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
		console.log("set @id", id??context.name)
		context.metadata[ID_PROPS] = id ?? context.name;
	})
}


/** \@content to automatically assign a element id to a component property and add element to component content (#content) */
export function content(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function content(value: undefined, context: ClassFieldDecoratorContext): void
export function content(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		console.log("set @content", id??context.name)
		context.metadata[CONTENT_PROPS] = id ?? context.name;
	})
}


/** @layout to automatically assign a element id to a component property and add element to component content container layout (#layout) */
export function layout(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function layout(value: undefined, context: ClassFieldDecoratorContext): void
export function layout(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		console.log("set @layout", id??context.name)
		context.metadata[LAYOUT_PROPS] = id ?? context.name;
	})
}


/** \@child to automatically assign a element id to a component property and add element as a component child */
export function child(id?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function child(value: undefined, context: ClassFieldDecoratorContext): void
export function child(id:string|undefined, context?: ClassFieldDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([id], context, ([id], context) => {
		console.log("set @child", id??context.name)
		context.metadata[CHILD_PROPS] = id ?? context.name;
	})
}

/** \@include to bind static properties */
export function include(resource?:string, export_name?:string): (value: undefined, context: ClassFieldDecoratorContext) => void
export function include(value: undefined, context: ClassFieldDecoratorContext): void
export function include(value: undefined|string, context?: ClassFieldDecoratorContext|string) {
	return handleClassFieldDecoratorWithOptionalArgs([value, context as string], context as ClassFieldDecoratorContext, 
		([resource, export_name], context) => {
			console.log("set @include", resource, export_name, context.name)
			context.metadata[IMPORT_PROPS] = [resource, export_name??context.name];
		}
	)
}

/** \@frontend decorator to declare methods that always run on the frontend */
export function frontend(_value: undefined, context: ClassFieldDecoratorContext|ClassMethodDecoratorContext) {
	context.metadata[STANDALONE_PROPS] = context.name;
}


/** @bindOrigin to declare methods that work in a standlone context, but are executed in the original context */
export function bindOrigin(options:{datex:boolean}): (value: undefined, context: ClassFieldDecoratorContext|ClassMethodDecoratorContext) => void
export function bindOrigin(value: undefined, context: ClassFieldDecoratorContext|ClassMethodDecoratorContext): void
export function bindOrigin(options:{datex:boolean}|undefined, context?: ClassFieldDecoratorContext|ClassMethodDecoratorContext) {
	return handleClassFieldDecoratorWithOptionalArgs([options], context as ClassFieldDecoratorContext, 
		([options], context:ClassFieldDecoratorContext|ClassMethodDecoratorContext) => {
			console.log("set @bindOrigin", options, context.name)
			context.metadata[STANDALONE_PROPS] = context.name;
			context.metadata[ORIGIN_PROPS] = options ?? {datex:false};
		}
	)
}