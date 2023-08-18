await Deno.run({
    cmd: [
        "deno",
        "run",
        "-Aq",
        "--import-map",
        "https://dev.cdn.unyt.org/importmap.json",
        "https://dev.cdn.unyt.org/uix/server/_file-server.ts",
        ...Deno.args
    ]
}).status()