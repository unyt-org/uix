// Copyright 2018-2022 the Deno authors. All rights reserved. MIT license.
import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.140.0/testing/asserts.ts";
import { join } from "https://deno.land/std@0.140.0/path/mod.ts";
import { bundle, transpile, transpileIsolated } from "./mod.ts";

Deno.test({
  name: "bundle - remote",
  async fn() {
    const result = await bundle(
      new URL("https://deno.land/std@0.140.0/examples/chat/server.ts"),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - url",
  async fn() {
    const result = await bundle(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - relative",
  async fn() {
    const result = await bundle(
      "./testdata/mod.ts",
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - absolute",
  async fn() {
    const result = await bundle(
      join(Deno.cwd(), "testdata", "mod.ts"),
    );
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - source",
  async fn() {
    const result = await bundle(new URL("file:///src.ts"), {
      async load(specifier) {
        if (specifier !== "file:///src.ts") return undefined;
        const content = await Deno.readTextFile(
          join(Deno.cwd(), "testdata", "mod.ts"),
        );
        return { kind: "module", specifier, content };
      },
    });
    console.log(result);
    assert(result.code);
  },
});

Deno.test({
  name: "bundle - json escapes",
  async fn() {
    const result = await bundle("./testdata/escape.ts");
    const { code } = result;
    assert(code);
    const EOL = Deno?.build?.os === "windows"
      ? String.raw`\r\n`
      : String.raw`\n`;
    // This is done on purpose, as `String.raw` still performs a string interpolation,
    // and we want a literal value ${jsInterpolation" as is, without any modifications.
    // We should not need to escape `$` nor `{` as they are both JSON-safe characters.
    const jsInterpolation = "${jsInterpolation}";
    assertStringIncludes(
      code,
      String
        .raw`const __default = JSON.parse("{${EOL}  \"key\": \"a value with newline\\n, \\\"double quotes\\\", 'single quotes', and ${jsInterpolation}\"${EOL}}");`,
    );
  },
});

Deno.test({
  name: "transpile - remote",
  async fn() {
    const result = await transpile(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );

    console.log(result);
    assertEquals(Object.keys(result).length, 18);
    const code =
      result["https://deno.land/std@0.140.0/examples/chat/server.ts"];
    assert(code);
  },
});

Deno.test({
  name: "transpile - url",
  async fn() {
    const result = await transpile(
      new URL(
        "https://deno.land/std@0.140.0/examples/chat/server.ts",
      ),
    );

    console.log(result);
    assertEquals(Object.keys(result).length, 18);
    const code =
      result["https://deno.land/std@0.140.0/examples/chat/server.ts"];
    assert(code);
  },
});

Deno.test({
  name: "transpile - relative",
  async fn() {
    const result = await transpile("./testdata/mod.ts");

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code);
    assertStringIncludes(code, "export default function hello()");
  },
});

Deno.test({
  name: "transpile - no inline source map",
  async fn() {
    const result = await transpile("./testdata/mod.ts", {compilerOptions: {sourceMap:false, inlineSourceMap: false}});

    const code = result[Object.keys(result)[0]];
    assert(code);
    assert(!code.includes("sourceMappingURL="));
  },
});

Deno.test({
  name: "transpile - absolute",
  async fn() {
    const result = await transpile(join(Deno.cwd(), "testdata", "mod.ts"));

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code);
    assertStringIncludes(code, "export default function hello()");
  },
});

Deno.test({
  name: "transpile - source",
  async fn() {
    const result = await transpile(new URL("file:///src.ts"), {
      async load(specifier) {
        if (specifier !== "file:///src.ts") return undefined;
        const content = await Deno.readTextFile(
          join(Deno.cwd(), "testdata", "mod.ts"),
        );
        return { kind: "module", specifier, content };
      },
    });

    console.log(result);
    assertEquals(Object.keys(result).length, 1);
    const code = result[Object.keys(result)[0]];
    assert(code);
    assertStringIncludes(code, "export default function hello()");
  },
});


Deno.test({
  name: "transpile isolated module",
  async fn() {
    const result = await transpileIsolated("./testdata/mod.ts");
    console.log(result);
    assert(result);
    assertStringIncludes(result, "export default function hello()");
  },
});


Deno.test({
  name: "transpile isolated tsx module",
  async fn() {
    const result = await transpileIsolated("./testdata/mod.tsx");
    console.log(result);
    assert(result);
    assertStringIncludes(result, 'React.createElement("div", null)');
  },
});


Deno.test({
  name: "transpile isolated tsx automatic module",
  async fn() {
    const result = await transpileIsolated("./testdata/mod.tsx", {jsxImportSource:"x", jsxAutomatic:true});
    console.log(result);
    assert(result);
    assertStringIncludes(result, 'import { jsx as _jsx } from "x/jsx-runtime');
  },
});


Deno.test({
  name: "transpile isolated tsx module with custom content",
  async fn() {
    const result = await transpileIsolated("file://src.ts", {}, 'export default function helloSrc() {}');
    console.log(result);
    assert(result);
    assertStringIncludes(result, 'export default function helloSrc() {}');
  },
});
