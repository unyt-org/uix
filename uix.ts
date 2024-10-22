// Global constants
import { client_type } from "datex-core-legacy/utils/constants.ts";
import { ThemeManagerType, getThemeManager } from "./src/base/theme-manager.ts";
import { UIX_COOKIE, setCookie } from "./src/session/cookies.ts";
import { Path } from "./src/utils/path.ts";
import { Datex } from "datex-core-legacy";
import { cache_path } from "datex-core-legacy/runtime/cache_path.ts";
import { version } from "./src/utils/version.ts";

/* <module> */
// deno-lint-ignore-file no-unused-vars
// This part is auto generated to allow Deno to resolve the uix-modules
import type * as _uix_0 from "uix/hydration/partial.ts";
import type * as _uix_1 from "uix/hydration/partial-hydration.ts";
import type * as _uix_2 from "uix/hydration/hydrate.ts";
import type * as _uix_3 from "uix/routing/frontend-routing.ts";
import type * as _uix_4 from "uix/routing/rendering.ts";
import type * as _uix_5 from "uix/routing/context.ts";
import type * as _uix_6 from "uix/routing/request-methods.ts";
import type * as _uix_7 from "uix/routing/route-filter.ts";
import type * as _uix_8 from "uix/routing/backend-entrypoint-proxy.ts";
import type * as _uix_9 from "uix/routing/route-param-types.ts";
import type * as _uix_10 from "uix/html/unsafe-html.ts";
import type * as _uix_11 from "uix/html/style.ts";
import type * as _uix_12 from "uix/html/editable-template.ts";
import type * as _uix_13 from "uix/html/http-error.ts";
import type * as _uix_14 from "uix/html/dependency-resolver.ts";
import type * as _uix_15 from "uix/html/authorization-proxy.ts";
import type * as _uix_16 from "uix/html/light-root.ts";
import type * as _uix_17 from "uix/html/template-strings.ts";
import type * as _uix_18 from "uix/html/http-status.ts";
import type * as _uix_19 from "uix/html/render.ts";
import type * as _uix_20 from "uix/html/template.ts";
import type * as _uix_21 from "uix/jsx-runtime/jsx.ts";
import type * as _uix_22 from "uix/base/decorators.ts";
import type * as _uix_23 from "uix/base/open-graph.ts";
import type * as _uix_24 from "uix/base/render-methods.ts";
import type * as _uix_25 from "uix/base/uix-datex-module.ts";
import type * as _uix_26 from "uix/base/theme-manager.ts";
import type * as _uix_27 from "uix/base/init.ts";
import type * as _uix_28 from "uix/base/blank.ts";
import type * as _uix_29 from "uix/themes/tailwindcss.ts";
import type * as _uix_30 from "uix/themes/uix-dark.ts";
import type * as _uix_31 from "uix/themes/uix-dark-plain.ts";
import type * as _uix_32 from "uix/themes/uix-light-plain.ts";
import type * as _uix_33 from "uix/themes/uix-light.ts";
import type * as _uix_34 from "uix/server/ts-import-resolver.ts";
import type * as _uix_35 from "uix/server/file-server-runner.ts";
import type * as _uix_36 from "uix/server/standalone-file-server.ts";
import type * as _uix_37 from "uix/server/server.ts";
import type * as _uix_38 from "uix/server/transpiler.ts";
import type * as _uix_39 from "uix/server/network-interface.ts";
import type * as _uix_40 from "uix/components/Component.ts";
import type * as _uix_41 from "uix/lib/cookie/cookie.ts";
import type * as _uix_42 from "uix/_uix_compat.ts";
import type * as _uix_43 from "uix/app/sse-observer.ts";
import type * as _uix_44 from "uix/app/module-mapping.ts";
import type * as _uix_45 from "uix/app/frontend-manager.ts";
import type * as _uix_46 from "uix/app/convert-to-web-path.ts";
import type * as _uix_47 from "uix/app/backend-manager.ts";
import type * as _uix_48 from "uix/app/config-files.ts";
import type * as _uix_49 from "uix/app/app-data-standalone.ts";
import type * as _uix_50 from "uix/app/dx-config-parser.ts";
import type * as _uix_51 from "uix/app/app-data.ts";
import type * as _uix_52 from "uix/app/help.ts";
import type * as _uix_53 from "uix/app/client-scripts/default.ts";
import type * as _uix_54 from "uix/app/client-scripts/sw.ts";
import type * as _uix_55 from "uix/app/build-lock.ts";
import type * as _uix_56 from "uix/app/start-app.ts";
import type * as _uix_57 from "uix/app/app.ts";
import type * as _uix_58 from "uix/app/http-over-datex.ts";
import type * as _uix_59 from "uix/app/debugging/logs-backend.ts";
import type * as _uix_60 from "uix/app/debugging/network-backend.ts";
import type * as _uix_61 from "uix/app/dom-context.ts";
import type * as _uix_62 from "uix/app/utils.ts";
import type * as _uix_63 from "uix/app/args.ts";
import type * as _uix_64 from "uix/app/app-plugin.ts";
import type * as _uix_65 from "uix/app/datex-over-http.ts";
import type * as _uix_66 from "uix/app/eternal-module-generator.ts";
import type * as _uix_67 from "uix/app/default-domain.ts";
import type * as _uix_68 from "uix/app/options.ts";
import type * as _uix_69 from "uix/app/start.ts";
import type * as _uix_70 from "uix/app/shared-deno.ts";
import type * as _uix_71 from "uix/background-runner/background-runner.ts";
import type * as _uix_72 from "uix/background-runner/sse-listener.ts";
import type * as _uix_73 from "uix/runners/run-local.ts";
import type * as _uix_74 from "uix/runners/run-remote.ts";
import type * as _uix_75 from "uix/runners/run-local-docker.ts";
import type * as _uix_76 from "uix/runners/runner.ts";
import type * as _uix_77 from "uix/plugins/git-deploy.ts";
import type * as _uix_78 from "uix/session/frontend.ts";
import type * as _uix_79 from "uix/session/backend.ts";
import type * as _uix_80 from "uix/session/cookies.ts";
import type * as _uix_81 from "uix/session/shared-data.ts";
import type * as _uix_82 from "uix/standalone/call-compat.ts";
import type * as _uix_83 from "uix/standalone/scroll_container.ts";
import type * as _uix_84 from "uix/standalone/bound_content_properties.ts";
import type * as _uix_85 from "uix/standalone/create-static-object.ts";
import type * as _uix_86 from "uix/standalone/get_prototype_properties.ts";
import type * as _uix_87 from "uix/sw/sw-installer.ts";
import type * as _uix_88 from "uix/sw/sw.ts";
import type * as _uix_89 from "uix/uix-dom/attributes.ts";
import type * as _uix_90 from "uix/uix-dom/html-template-strings/html-template-strings.ts";
import type * as _uix_91 from "uix/uix-dom/jsx/mod.ts";
import type * as _uix_92 from "uix/uix-dom/jsx/jsx-definitions.ts";
import type * as _uix_93 from "uix/uix-dom/jsx/parser.ts";
import type * as _uix_94 from "uix/uix-dom/jsx/fragment.ts";
import type * as _uix_95 from "uix/uix-dom/datex-bindings/mod.ts";
import type * as _uix_96 from "uix/uix-dom/datex-bindings/transform-wrapper.ts";
import type * as _uix_97 from "uix/uix-dom/datex-bindings/blob-to-base64.ts";
import type * as _uix_98 from "uix/uix-dom/datex-bindings/type-definitions.ts";
import type * as _uix_99 from "uix/uix-dom/datex-bindings/dom-utils.ts";
import type * as _uix_100 from "uix/uix-dom/datex-bindings/dom-datex-types.ts";
import type * as _uix_101 from "uix/uix-dom/dom/mod.ts";
import type * as _uix_102 from "uix/uix-dom/dom/shadow_dom_selector.ts";
import type * as _uix_103 from "uix/uix-dom/dom/DOMContext.ts";
import type * as _uix_104 from "uix/uix-dom/dom/deno-dom/test/wpt.ts";
import type * as _uix_105 from "uix/uix-dom/dom/deno-dom/test/units.ts";
import type * as _uix_106 from "uix/uix-dom/dom/deno-dom/test/units/cloneNode.ts";
import type * as _uix_107 from "uix/uix-dom/dom/deno-dom/test/units/Node-compareDocumentPosition.ts";
import type * as _uix_108 from "uix/uix-dom/dom/deno-dom/test/units/case-insensitive-attributes.ts";
import type * as _uix_109 from "uix/uix-dom/dom/deno-dom/test/units/NodeList-compatible-api.ts";
import type * as _uix_110 from "uix/uix-dom/dom/deno-dom/test/units/Element-prepend.ts";
import type * as _uix_111 from "uix/uix-dom/dom/deno-dom/test/units/Node-nodesAndTextNodes-ancestor-check.ts";
import type * as _uix_112 from "uix/uix-dom/dom/deno-dom/test/units/Element-firstElementChild.ts";
import type * as _uix_113 from "uix/uix-dom/dom/deno-dom/test/units/parse-empty-template.ts";
import type * as _uix_114 from "uix/uix-dom/dom/deno-dom/test/units/Node-nodeValue.ts";
import type * as _uix_115 from "uix/uix-dom/dom/deno-dom/test/units/CharacterData.ts";
import type * as _uix_116 from "uix/uix-dom/dom/deno-dom/test/units/Element-children-sync-childNodes.ts";
import type * as _uix_117 from "uix/uix-dom/dom/deno-dom/test/units/child-element-count.ts";
import type * as _uix_118 from "uix/uix-dom/dom/deno-dom/test/units/Element-classList.ts";
import type * as _uix_119 from "uix/uix-dom/dom/deno-dom/test/units/Node-appendChild.ts";
import type * as _uix_120 from "uix/uix-dom/dom/deno-dom/test/units/Element-id.ts";
import type * as _uix_121 from "uix/uix-dom/dom/deno-dom/test/units/Element-outerHTML.ts";
import type * as _uix_122 from "uix/uix-dom/dom/deno-dom/test/units/NamedNodeMap.ts";
import type * as _uix_123 from "uix/uix-dom/dom/deno-dom/test/units/Node-nodesAndTextNodes-sibllings.ts";
import type * as _uix_124 from "uix/uix-dom/dom/deno-dom/test/units/noscript-has-domtree.ts";
import type * as _uix_125 from "uix/uix-dom/dom/deno-dom/test/units/comments-outside-html-test.ts";
import type * as _uix_126 from "uix/uix-dom/dom/deno-dom/test/units/Element-matches.ts";
import type * as _uix_127 from "uix/uix-dom/dom/deno-dom/test/units/throws-dom-exception.ts";
import type * as _uix_128 from "uix/uix-dom/dom/deno-dom/test/units/Node-removeChild.ts";
import type * as _uix_129 from "uix/uix-dom/dom/deno-dom/test/units/Element-localName.ts";
import type * as _uix_130 from "uix/uix-dom/dom/deno-dom/test/units/Node-nodeType-constants.ts";
import type * as _uix_131 from "uix/uix-dom/dom/deno-dom/test/units/Element-getElementsBy.ts";
import type * as _uix_132 from "uix/uix-dom/dom/deno-dom/test/units/Node-events.ts";
import type * as _uix_133 from "uix/uix-dom/dom/deno-dom/test/units/comments-in-outerhtml.ts";
import type * as _uix_134 from "uix/uix-dom/dom/deno-dom/test/units/large-child-count.ts";
import type * as _uix_135 from "uix/uix-dom/dom/deno-dom/test/units/adjacent-siblings.ts";
import type * as _uix_136 from "uix/uix-dom/dom/deno-dom/test/units/instanceof.ts";
import type * as _uix_137 from "uix/uix-dom/dom/deno-dom/test/units/Element-getElementsByTagName-wildcard.ts";
import type * as _uix_138 from "uix/uix-dom/dom/deno-dom/test/units/DocumentFragment.ts";
import type * as _uix_139 from "uix/uix-dom/dom/deno-dom/test/units/Element-append.ts";
import type * as _uix_140 from "uix/uix-dom/dom/deno-dom/test/units/HTMLElement-innerText.ts";
import type * as _uix_141 from "uix/uix-dom/dom/deno-dom/test/units/Node-replaceWith-child.ts";
import type * as _uix_142 from "uix/uix-dom/dom/deno-dom/test/units/HTMLTemplateElement.ts";
import type * as _uix_143 from "uix/uix-dom/dom/deno-dom/test/units/Element-closest.ts";
import type * as _uix_144 from "uix/uix-dom/dom/deno-dom/test/units/Element-lastElementChild.ts";
import type * as _uix_145 from "uix/uix-dom/dom/deno-dom/test/units/Element-set-innerHTML.ts";
import type * as _uix_146 from "uix/uix-dom/dom/deno-dom/test/units/remove-attribute-delete.ts";
import type * as _uix_147 from "uix/uix-dom/dom/deno-dom/test/units/querySelectorAll-selector-list.ts";
import type * as _uix_148 from "uix/uix-dom/dom/deno-dom/test/units/Node-insertBefore.ts";
import type * as _uix_149 from "uix/uix-dom/dom/deno-dom/test/units/collections-toString.ts";
import type * as _uix_150 from "uix/uix-dom/dom/deno-dom/test/wpt-runner-worker.ts";
import type * as _uix_151 from "uix/uix-dom/dom/deno-dom/test/wpt-runner.ts";
import type * as _uix_152 from "uix/uix-dom/dom/deno-dom/deno-dom-wasm-noinit.ts";
import type * as _uix_153 from "uix/uix-dom/dom/deno-dom/deno-dom-native.ts";
import type * as _uix_154 from "uix/uix-dom/dom/deno-dom/deno-dom-wasm.ts";
import type * as _uix_155 from "uix/uix-dom/dom/deno-dom/native.test.ts";
import type * as _uix_156 from "uix/uix-dom/dom/deno-dom/build/deno-wasm/deno-wasm.d.ts";
import type * as _uix_157 from "uix/uix-dom/dom/deno-dom/build/deno-wasm/deno-wasm_bg.d.ts";
import type * as _uix_158 from "uix/uix-dom/dom/deno-dom/wasm.test.ts";
import type * as _uix_159 from "uix/uix-dom/dom/deno-dom/src/deserialize.ts";
import type * as _uix_160 from "uix/uix-dom/dom/deno-dom/src/api.ts";
import type * as _uix_161 from "uix/uix-dom/dom/deno-dom/src/parser.ts";
import type * as _uix_162 from "uix/uix-dom/dom/deno-dom/src/constructor-lock.ts";
import type * as _uix_163 from "uix/uix-dom/dom/deno-dom/src/css/CSSStylesheet.ts";
import type * as _uix_164 from "uix/uix-dom/dom/deno-dom/src/css/CSSStyleDeclaration.ts";
import type * as _uix_165 from "uix/uix-dom/dom/deno-dom/src/dom/custom-element-registry.ts";
import type * as _uix_166 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-template-element.ts";
import type * as _uix_167 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-div-element.ts";
import type * as _uix_168 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-image-element.ts";
import type * as _uix_169 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-select-element.ts";
import type * as _uix_170 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-input-element.ts";
import type * as _uix_171 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-option-element.ts";
import type * as _uix_172 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-heading-element.ts";
import type * as _uix_173 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-dialog-element.ts";
import type * as _uix_174 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-form-element.ts";
import type * as _uix_175 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-media-element.ts";
import type * as _uix_176 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-button-element.ts";
import type * as _uix_177 from "uix/uix-dom/dom/deno-dom/src/dom/html-elements/html-video-element.ts";
import type * as _uix_178 from "uix/uix-dom/dom/deno-dom/src/dom/selectors/sizzle-types.ts";
import type * as _uix_179 from "uix/uix-dom/dom/deno-dom/src/dom/selectors/nwsapi-types.ts";
import type * as _uix_180 from "uix/uix-dom/dom/deno-dom/src/dom/selectors/custom-api.ts";
import type * as _uix_181 from "uix/uix-dom/dom/deno-dom/src/dom/selectors/selectors.ts";
import type * as _uix_182 from "uix/uix-dom/dom/deno-dom/src/dom/node-list.ts";
import type * as _uix_183 from "uix/uix-dom/dom/deno-dom/src/dom/types/tags.ts";
import type * as _uix_184 from "uix/uix-dom/dom/deno-dom/src/dom/document.ts";
import type * as _uix_185 from "uix/uix-dom/dom/deno-dom/src/dom/html-collection.ts";
import type * as _uix_186 from "uix/uix-dom/dom/deno-dom/src/dom/dom-string-map.ts";
import type * as _uix_187 from "uix/uix-dom/dom/deno-dom/src/dom/mutation-observer.ts";
import type * as _uix_188 from "uix/uix-dom/dom/deno-dom/src/dom/dom-parser.ts";
import type * as _uix_189 from "uix/uix-dom/dom/deno-dom/src/dom/elements/math-ml-element.ts";
import type * as _uix_190 from "uix/uix-dom/dom/deno-dom/src/dom/elements/svg-element.ts";
import type * as _uix_191 from "uix/uix-dom/dom/deno-dom/src/dom/elements/shadow-root.ts";
import type * as _uix_192 from "uix/uix-dom/dom/deno-dom/src/dom/elements/html-element.ts";
import type * as _uix_193 from "uix/uix-dom/dom/deno-dom/src/dom/node.ts";
import type * as _uix_194 from "uix/uix-dom/dom/deno-dom/src/dom/utils-types.ts";
import type * as _uix_195 from "uix/uix-dom/dom/deno-dom/src/dom/utils.ts";
import type * as _uix_196 from "uix/uix-dom/dom/deno-dom/src/dom/element.ts";
import type * as _uix_197 from "uix/uix-dom/dom/deno-dom/src/dom/document-fragment.ts";
import type * as _uix_198 from "uix/uix-dom/dom/deno-dom/bench/bench-wasm-dom.ts";
import type * as _uix_199 from "uix/uix-dom/dom/deno-dom/bench/bench-native-parse.ts";
import type * as _uix_200 from "uix/uix-dom/dom/deno-dom/bench/bench-native-dom.ts";
import type * as _uix_201 from "uix/uix-dom/dom/deno-dom/bench/bench-wasm-parse.ts";
import type * as _uix_202 from "uix/utils/path.ts";
import type * as _uix_203 from "uix/utils/files.ts";
import type * as _uix_204 from "uix/utils/css-style-compat.ts";
import type * as _uix_205 from "uix/utils/overlay-scrollbars.ts";
import type * as _uix_206 from "uix/utils/semaphore.ts";
import type * as _uix_207 from "uix/utils/login.ts";
import type * as _uix_208 from "uix/utils/css-scoping.ts";
import type * as _uix_209 from "uix/utils/global-values.ts";
import type * as _uix_210 from "uix/utils/check-ci.ts";
import type * as _uix_211 from "uix/utils/init-base-project.ts";
import type * as _uix_212 from "uix/utils/importmap.ts";
import type * as _uix_213 from "uix/utils/safari.ts";
import type * as _uix_214 from "uix/utils/scheduling.ts";
import type * as _uix_215 from "uix/utils/serialize-js.ts";
import type * as _uix_216 from "uix/utils/version.ts";
import type * as _uix_217 from "uix/utils/css-template-strings.ts";
import type * as _uix_218 from "uix/utils/window-apis.ts";
import type * as _uix_219 from "uix/utils/uix-base-directory.ts";
import type * as _uix_220 from "uix/utils/ansi-to-html.ts";
import type * as _uix_221 from "uix/utils/git.ts";
import type * as _uix_222 from "uix/utils/file-utils.ts";
import type * as _uix_223 from "uix/utils/error-reporting-preference.ts";
import type * as _uix_224 from "uix/http/typed-requests.ts";
import type * as _uix_225 from "uix/providers/html.ts";
import type * as _uix_226 from "uix/providers/entrypoints.ts";
import type * as _uix_227 from "uix/providers/image.ts";
/* </module> */

/**
 * get UIX cache path
 */
const cacheDir = client_type == "deno" ? new Path<Path.Protocol.File, true>('./uix/', cache_path) : new Path<Path.Protocol.HTTP|Path.Protocol.HTTPS, true>('/@uix/cache/', location.origin);

type ReactiveThemeManager = ThemeManagerType & {$: {mode: Datex.Pointer<"dark"|"light">, theme: Datex.Pointer<string>}};

let themeManager: ReactiveThemeManager|undefined = undefined;

export const UIX = {
	version,
	get context() {
		return client_type === "deno" ? "backend" : "frontend";
	},
	cacheDir,


	get Theme(): ReactiveThemeManager {
		if (themeManager) return themeManager;

		themeManager = getThemeManager() as ReactiveThemeManager;
		const mode = $(UIX.Theme.mode)
		UIX.Theme.onModeChange(m => mode.val = m)

		const theme = $(UIX.Theme.theme)
		UIX.Theme.onThemeChange(m => theme.val = m)

		// define UIX.Theme.$.theme, UIX.Theme.$.mode
		themeManager.$ = Object.freeze({
			theme,
			mode
		})
		
		// redefine UIX.Theme.theme/mode getters to enable smart transforms / effects

		const themeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(themeManager), "theme")!.set!.bind(themeManager);
		const modeSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(themeManager), "mode")!.set!.bind(themeManager);

		Object.defineProperty(themeManager, "theme", {
			get() {
				return theme.val;
			},
			set(val: string) {
				themeSetter(val);
			}
		}) 

		Object.defineProperty(themeManager, "mode", {
			get() {
				return mode.val;
			},
			set(val: "dark"|"light") {
				modeSetter(val);
			}
		}) 

		return themeManager;
	},
	get language() {
		return Datex.Runtime.ENV.LANG;
	},
	set language(lang: string) {
		Datex.Runtime.ENV.LANG = lang;
	}
}

if (client_type == "browser") {
	// update uix-language cookie (only works if runtime initialized!)
	observe(Datex.Runtime.ENV.$.LANG, lang => {
		setCookie(UIX_COOKIE.language, lang)
		document.documentElement?.setAttribute("lang", lang)
	})

	// make sure UIX theme manager is activated
	getThemeManager();
}

// create cache dir if not exists
if (UIX.context == "backend" && !UIX.cacheDir.fs_exists) Deno.mkdirSync(cacheDir, {recursive:true})

// @ts-ignore
globalThis.UIX = UIX;