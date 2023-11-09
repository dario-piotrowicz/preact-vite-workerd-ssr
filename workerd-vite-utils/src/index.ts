import { IncomingMessage } from "http";
import { ViteDevServer } from "vite";
import { createMiniflareInstance } from "./miniflare.js";
//@ts-ignore
import workerdBootloader from "./workerdBootloader.js.txt";

export function createWorkerdHandler({
	entrypoint,
	server,
	frameworkRequestHandlingJs,
}: {
	entrypoint: string;
	server: ViteDevServer;
	frameworkRequestHandlingJs: string;
}) {
	const viteHttpServerAddress = server.httpServer.address();

	// const viteServerAddress =
	// 	typeof viteHttpServerAddress === "string"
	// 		? viteHttpServerAddress
	// 		: `http://${viteHttpServerAddress.address}:${viteHttpServerAddress.port}`;

	// HACK
	const viteServerAddress = "http://localhost:3000";

	const bootloader = workerdBootloader
		.replace(/VITE_SERVER_ADDRESS/, viteServerAddress)
		.replace(/WORKERD_APP_ENTRYPOINT/, entrypoint)
		.replace(/GENERATE_RESPONSE/, frameworkRequestHandlingJs);

	// create miniflare instance
	// load it with module loader code and import to the entry point

	const mf = createMiniflareInstance({ script: bootloader });

	// this could be in the future replaced with websockets
	server.middlewares.use(async (request, resp, next) => {
		if (!request.url.startsWith("/__workerd_loader/")) {
			next();
			return;
		}

		// the request is for the workerd loader so we need to handle it
		const url = new URL(`http://localhost${request.url}`);

		// searchParams.get strips "+" characters which affects module resolution
		const moduleId = url.searchParams.get("moduleId").replace(/ /g, "+");

		const moduleCode = (
			await server.transformRequest(moduleId, {
				ssr: true,
			})
		).code;

		console.log("resolved: " + moduleId);
		// if (/createComponent\b/.test(moduleCode)) {
		// console.log("found `createComponent` call in: " + moduleId);
		// debugger;
		// }

		// if (moduleId.includes("StartServer.tsx")) {
		// 	console.log(moduleCode);
		// }

		resp.writeHead(200, { "Content-Type": "text/plain" });
		resp.end(moduleCode);
	});

	return async function workerdRequestHandler(request: IncomingMessage) {
		let url = request.url.startsWith("/")
			? `http://localhost${request.url}`
			: request.url;

		// TODO: we should support POST requests with body as well
		//       for that we need something along the lines of
		//       https://github.com/sveltejs/kit/blob/master/packages/kit/src/exports/node/index.js#L8
		return mf.dispatchFetch(url, {
			headers: request.headers,
			method: request.method || "GET",
		});
	};
}
