import { IncomingMessage } from "http";
import { ViteDevServer } from "vite";
import { instantiateMiniflare } from "./miniflare.js";

import type { Miniflare } from "miniflare";

export function createWorkerdHandler(opts: {
	entrypoint: string;
	server: ViteDevServer;
	requestHandler: (opts: {
		entrypointModule: any;
		request: Request;
		context: { waitUntil: (p: Promise<unknown>) => void }
	}) => Response | Promise<Response>;
}) {
	const { server } = opts;
	console.log("create handler");

	let mf: Miniflare | null;

	if (server.httpServer.listening) {
		mf = instantiateMiniflare(opts);
	} else {
		server.httpServer.once("listening", () => {
			mf = instantiateMiniflare(opts);
		});
	}

	// this could be in the future replaced with websockets
	server.middlewares.use(async (request, resp, next) => {
		if (!request.url.startsWith("/__workerd_loader/")) {
			next();
			return;
		}

		// the request is for the workerd loader so we need to handle it
		const url = new URL(`http://localhost${request.url}`);
		let moduleId = url.searchParams.get("moduleId");
		if(moduleId==='zod'){
		  // temporary hack, we need to figure out node_modules resolution!
		  moduleId = '/Users/dario/Repos/qwik/node_modules/.pnpm/zod@3.22.4/node_modules/zod/lib/index.mjs';
		}

		console.log(
			`\x1b[44m [workerd loader] handling request for module ${moduleId} \x1b[0m`,
		);

		const moduleCode = (
			await server.transformRequest(moduleId, {
				ssr: true,
			})
		).code;
		resp.writeHead(200, { "Content-Type": "text/plain" });

		// console.log(`\x1b[46mresult:\n\n${moduleCode}\n\n\x1b[0m`);

		resp.end(moduleCode);
	});

	return async function workerdRequestHandler(request: IncomingMessage) {
		let url = request.url.startsWith("/")
			? `http://localhost${request.url}`
			: request.url;

		if (!mf) {
			// this check is here as a precaution, it should never happen
			// that at this point miniflare is not initialized!
			throw new Error("miniflare not initialized!");
		}

		// TODO: we should support POST requests with body as well
		//       for that we need something along the lines of
		//       https://github.com/sveltejs/kit/blob/master/packages/kit/src/exports/node/index.js#L8
		return mf.dispatchFetch(url, {
			headers: request.headers,
			method: request.method || "GET",
		});
	};
}
