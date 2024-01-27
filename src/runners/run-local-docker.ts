import { json2yaml } from "https://deno.land/x/json2yaml@v1.0.1/mod.ts";
import { Path } from "../utils/path.ts";
import { clear, stage, watch } from "../app/args.ts";
import { createHash } from "https://deno.land/std@0.91.0/hash/mod.ts";
// import { Datex } from "datex-core-legacy/no_init.ts";
import { UIXRunner, runOptions } from "./runner.ts";
import { ESCAPE_SEQUENCES } from "datex-core-legacy/datex_all.ts";
import { OutputMode, exec } from "https://deno.land/x/exec@0.0.5/mod.ts";

import { verboseArg } from "datex-core-legacy/utils/logger.ts"

declare const Datex: any; // cannot import Datex here, circular dependency problems


const logger = new Datex.Logger("Docker Runner");

export default class LocalDockerRunner implements UIXRunner {
	name = "local-docker"

	async run(runOptions: runOptions) {
	
		const deploymentDir = new Path(`./docker/${stage}/`, Datex.cache_path);
		if (!deploymentDir.fs_exists) await Deno.mkdir(deploymentDir, {recursive: true});

		const fileName = `docker-compose.yml`;
		const filePath = deploymentDir.getChildPath(fileName)
		const content = this.generateDockerComposeFile(runOptions, deploymentDir);
		await Deno.writeTextFile(filePath.normal_pathname, content)

		console.log('Deploying "'+runOptions.options.name+'" ('+stage+')...');
	
		// make sure main network exists
		const network = "main"
		await execCommand(`docker network inspect ${network} &>/dev/null || docker network create ${network}`)

		// first make sure container is not already running
		await new Deno.Command("docker-compose", {
			args: [
				"-f",
				filePath.normal_pathname,
				"down"
			]
		}).output();

		const output = await new Deno.Command("docker-compose", {
			args: [
				// "compose",
				"-f",
				filePath.normal_pathname,
				"up",
				"-d"
			]
		}).output();

		if (!output.success) {
			logger.error(new TextDecoder().decode(output.stderr));
			Deno.exit(1);
		}
		else {
			const id = (await execCommand("docker ps -l")).split("\n")[1]?.split(" ")[0] ?? "unknown id";
			console.log(ESCAPE_SEQUENCES.GREEN + runOptions.endpoint + (Object.keys(runOptions.domains).length ? ` (${Object.keys(runOptions.domains).map(domain=>`https://${domain}`).join(", ")})` : '') +" is running in local docker container ("+id+")" + ESCAPE_SEQUENCES.RESET);
			
			if (runOptions.params.detach || id === "unknown id") {
				Deno.exit(0);
			}
		
			else {
				
				await new Deno.Command("docker", {
					args: [
						"logs",
						"--follow",
						id
					]
				}).spawn().status;
			}

		}

	}

	generateDockerComposeFile({baseURL, endpoint, domains, params}: runOptions, deploymentDir: Path) {
		if (!endpoint) throw new Error("Missing in endpoint for stage '" + stage + "' ('"+this.name+"' runner)");

		const name = endpoint.toString().replace(/[^A-Za-z0-9_-]/g,'').toLowerCase()
		const traefikLabels = new Set()
		let i = 0;
		for (const [host, port] of Object.entries(domains)) {
			for (const label of this.getTraefikLabels(name + '_' + (i++), host, port)) traefikLabels.add(label)
		}

		const dxCacheVolumeName = name.replace(/[^a-zA-Z0-9_.-]/g, '-') + '-datex-cache'
		const localStorage = name.replace(/[^a-zA-Z0-9_.-]/g, '-') + '-localstorage'

		// TODO: generic arg sanitisation (also for run-remote)
		// TODO: inject args dynamically? not in docker compose file
		const args = [];
		if (watch) args.push("--watch");
		if (verboseArg) args.push("-v")
		if (clear) args.push("--clear");

		const ports = []

		if (params.inspect!=undefined) {
			args.push("--inspect=0.0.0.0:9229");
			ports.push(`${params.inspect||'9229'}:${params.inspect||'9229'}`)
		}

		const dockerCompose = {
			version: "3",

			services: {
				"uix-app": {
					container_name: `${name}`,
					image: "denoland/deno:1.39.4",

					expose: ["80"],
					ports,
	
					environment: [
						"UIX_HOST_ENDPOINT=local-docker",
						`UIX_HOST_DOMAINS=${Object.keys(domains).join(",")}`
					],

					networks: ["main"],
					working_dir: "/app",
					volumes: [
						`${new Path(baseURL).getAsRelativeFrom(deploymentDir)}:/app`,
						`${dxCacheVolumeName}:/datex-cache`,
						`${localStorage}:/deno-dir/location_data`
					],
					labels: [...traefikLabels],
					
					entrypoint: "/bin/sh",
					// keep dev.cdn for now to allow supranet relays to start without cdn running
    				command: `-c "deno run --import-map https://dev.cdn.unyt.org/uix1/importmap.dev.json -Aqr https://dev.cdn.unyt.org/uix1/run.ts -r --port 80 --stage ${stage} --cache-path /datex-cache ${args.join(" ")}"`,
		
					restart: "always"
				}
			},
			volumes: {
				[dxCacheVolumeName]: {
					external: false
				},
				[localStorage]: {
					external: false
				}
			},
    
			networks: {
				main: {external: true}
			}
		}

		return `# This file was auto generated by the uix docker plugin. Do not manually edit.\n\n${json2yaml(JSON.stringify(dockerCompose))}` 
	}

	protected getTraefikLabels(name: string, host: string, port?: number|null) {
		name = name + "-" + createHash("md5").update(host).toString()
		const hasWildcard = host.startsWith('*.');

		const labels: string[] = []

		const hostRule = hasWildcard ?
			`HostRegexp(\`{subhost:[a-z0-9-_]+}.${host.slice(2)}\`)` :
			`Host(\`${host}\`)`;

		labels.push(`traefik.enable=true`);
		labels.push(`traefik.http.routers.${name}.rule=${hostRule}`);
		labels.push(`traefik.http.routers.${name}.entrypoints=web`);
		labels.push(`traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https`);
		labels.push(`traefik.http.routers.${name}.middlewares=redirect-to-https@docker`);
		labels.push(`traefik.http.routers.${name}-secured.rule=${hostRule}`);
		labels.push(`traefik.http.routers.${name}-secured.tls=true`);

		if (hasWildcard) {
			const rawHost = host.slice(2);
			labels.push(`traefik.http.routers.${name}-secured.tls.domains[0].main=${rawHost}`);
			labels.push(`traefik.http.routers.${name}-secured.tls.domains[0].sans=${host}`);
			labels.push(`traefik.http.routers.${name}.tls.domains[0].main=${rawHost}`);
			labels.push(`traefik.http.routers.${name}.tls.domains[0].sans=${host}`);
			labels.push(`traefik.http.routers.${name}-secured.tls.certresolver=mydnschallenge`);
		} 
		else {
			labels.push(`traefik.http.routers.${name}-secured.tls.certresolver=myhttpchallenge`);
		}

		if (port) {
			labels.push(`traefik.http.routers.${name}.service=${name}`);
			labels.push(`traefik.http.routers.${name}-secured.service=${name}`);
			labels.push(`traefik.http.services.${name}.loadbalancer.server.port=${port}`);
		}

		return labels;
	}
}

async function execCommand<DenoRun extends boolean = false>(command:string, denoRun?:DenoRun): Promise<DenoRun extends true ? Deno.ProcessStatus : string> {
	if (denoRun) {
		const status = await Deno.run({
			cmd: command.split(" "),
		}).status();
	
		if (!status.success) throw status.code;
		else return status as any;
	}
	else {
		const {status, output} = (await exec(`bash -c "${command.replaceAll('"', '\\"')}"`, {output: OutputMode.Capture}));
		if (!status.success) throw output;
		else return output  as any;
	}
}