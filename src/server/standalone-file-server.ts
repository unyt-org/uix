await Deno.run({
    cmd: [
        "deno",
        "run",
        "-Aq",
        "--import-map",
        "https://cdn.unyt.org/uix/importmap.json",
        "https://cdn.unyt.org/uix/src/server/file-server-runner.ts",
        ...Deno.args
    ]
}).status()