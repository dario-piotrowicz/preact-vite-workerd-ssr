import { Log, Miniflare } from "miniflare";
import type { ViteDevServer } from "vite";
//@ts-ignore
import workerdBootloader from "./workerdBootloader.js.txt";

export function instantiateMiniflare({
	entrypoint,
	server,
	frameworkRequestHandlingJs,
}: {
	entrypoint: string;
	server: ViteDevServer;
	frameworkRequestHandlingJs: string;
}): Miniflare {
	const viteHttpServerAddress = server.httpServer.address();
	const viteServerAddress =
		typeof viteHttpServerAddress === "string"
			? viteHttpServerAddress
			: `http://${
					/:/.test(viteHttpServerAddress.address)
						? "localhost"
						: viteHttpServerAddress.address
				}:${viteHttpServerAddress.port}`;

	const script = workerdBootloader
		.replace(/VITE_SERVER_ADDRESS/, viteServerAddress)
		.replace(/WORKERD_APP_ENTRYPOINT/, entrypoint)
		.replace(/GENERATE_RESPONSE/, frameworkRequestHandlingJs);

	// create miniflare instance
	// load it with module loader code and import to the entry point

	return new Miniflare({
		log: new Log(),
		modules: true,
		script,
		unsafeEvalBinding: "UNSAFE_EVAL",
	});
};
