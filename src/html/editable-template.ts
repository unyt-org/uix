import { getCallerFile, getCallerInfo } from "datex-core-legacy/utils/caller_metadata.ts";
import { createTemplateGenerator, jsxInputGenerator } from "./template.ts";
import { Class } from "datex-core-legacy/utils/global_types.ts";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { UIX } from "../../uix.ts";
import { getOuterHTML } from "./render.ts";
import { Path } from "datex-core-legacy/utils/path.ts";
import { app } from "../app/app.ts";

export function editableTemplate<
	Options extends Record<string, unknown> = Record<string, never>
>(
	propsInfo: {[key in keyof Options]: string},
	initialContent?: jsxInputGenerator<JSX.Element|Promise<JSX.Element>, Options, never, false, false>
): jsxInputGenerator<JSX.Element, Options, never>&((cl: Class, context: ClassDecoratorContext)=>any) {
	const info = getCallerInfo()?.[0];
	if (!info) throw new Error("Cannot get caller info");

	const module = info.file + "_" + info.row;

	// store initial template
	if (!hasStoredTemplate(module)) {
		const generator = initialContent ? createTemplateGenerator(initialContent, module) : null;
		const template = generator ? generateTemplateFromGenerator(generator, propsInfo) : "";
		updateTemplate(module, template);
	}
	
	return (...args) => getTemplateFunction(module, propsInfo)(...args);
}

type PropsDefinition = Record<string, string>;

const cachedTemplateGenerators = new Map<string, [Function, PropsDefinition]>();

function generateTemplateFromGenerator(generator: jsxInputGenerator<JSX.Element, any, never, false, false>, propsDefinition: PropsDefinition) {
	const placeholderProps = Object.fromEntries(Object.entries(propsDefinition).map(([key]) => [key, `{{${key}}}`]));
	const rendered = (generator as any)(placeholderProps, placeholderProps);
	const [_, html] = getOuterHTML(rendered, {
		plainHTML: true,
	});
	return html;
}

function hasStoredTemplate(modulePath: string) {
	const templatePath = getTemplatePath(modulePath)
	return templatePath.fs_exists;
}

function getStoredTemplate(modulePath: string) {
	const templatePath = getTemplatePath(modulePath)
	if (templatePath.fs_exists) {
		return Deno.readTextFileSync(templatePath.normal_pathname);
	}
	else return null
}

export function updateTemplate(modulePath: string, content: string) {
	const templatePath = getTemplatePath(modulePath);
	Deno.writeTextFileSync(templatePath.normal_pathname, content);
	if (cachedTemplateGenerators.has(modulePath)) updateTemplateFunction(modulePath, cachedTemplateGenerators.get(modulePath)![1]);
}

function getTemplateFunction(modulePath: string, propsInfo: PropsDefinition) {
	if (!cachedTemplateGenerators.has(modulePath)) {
		updateTemplateFunction(modulePath, propsInfo);
	}
	return cachedTemplateGenerators.get(modulePath)![0];
}

function updateTemplateFunction(modulePath: string, propsInfo: PropsDefinition) {
	const template = getStoredTemplate(modulePath);
	if (!template) throw new Error("Template not found");
	const propsDestructoringCode = `const {${
		Object.keys(propsInfo).join(", ")
	}} = props`;
	const generator = new Function('props', `${propsDestructoringCode}; const _genEl = HTML\`<uix-editable>${template.replace(/\{\{([^}]*)\}\}/g, '\${$1}')}</uix-editable>\`; _genEl.setAttribute("data-edit-location", "${modulePath}"); _genEl.setAttribute("data-edit-props", '${JSON.stringify(propsInfo)}'); return _genEl;`);

	cachedTemplateGenerators.set(modulePath, [generator, propsInfo]);
}


function getTemplatePath(modulePath: string|URL) {
	const modulePathObj = new Path(modulePath)
	const modulePathName = modulePathObj.isWeb() ? modulePathObj.toString() : modulePathObj.getAsRelativeFrom(app.base_url)
	const normalizedPath = modulePathName.replace(/[^a-zA-Z0-9]/g, "_").replace(/^_*/, "");
	const templateDir = UIX.cacheDir.getChildPath("templates").asDir();

	if (!templateDir.fs_exists) Deno.mkdirSync(templateDir.normal_pathname, {recursive: true});

	return templateDir.getChildPath(normalizedPath);
}