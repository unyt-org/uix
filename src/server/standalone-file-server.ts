await Deno.run({
    cmd: [
        "deno",
        "run",
        "-Aq",
        "--import-map",
        "https://dev.cdn.unyt.org/importmap.json",
        "--config",
        "https://dev.cdn.unyt.org/deno.json",
        "https://cdn.unyt.org/uix/src/server/file-server-runner.ts",
        ...Deno.args
    ]
}).status()