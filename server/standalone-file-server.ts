await Deno.run({
    cmd: [
        "deno",
        "run",
        "-Aq",
        "--import-map",
        "https://dev.cdn.unyt.org/importmap.json",
        "https://dev.cdn.unyt.org/uix/server/file-server-runner.ts",
        ...Deno.args
    ]
}).status()