await Deno.run({
    cmd: [
        "deno",
        "run",
        "-Aq",
        "--import-map",
        "https://dev.cdn.unyt.org/importmap.json",
        "https://dev.cdn.unyt.org/uix1/src/server/file-server-runner.ts",
        ...Deno.args
    ]
}).status()