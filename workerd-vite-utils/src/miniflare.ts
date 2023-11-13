import { Log, Miniflare } from "miniflare";
import type { ViteDevServer } from "vite";
//@ts-ignore
import workerdBootloader from "./workerdBootloader.js.txt";
import type { Handler, JSONValue } from "./index";

export function instantiateMiniflare<T extends JSONValue, U extends JSONValue>({
	server,
	handler,
}: {
	handler: Handler<T, U>;
	server: ViteDevServer;
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
		.replace(/__HANDLER__/, () => {
			const functionStr = handler.toString();

			if (
				functionStr.startsWith("async function handler(") ||
				functionStr.startsWith("function handler(")
			) {
				return functionStr;
			}

			if (functionStr.startsWith("handler(")) {
				return `function ${functionStr};`;
			}

			return `const handler = ${functionStr};`;
		});

	// create miniflare instance
	// load it with module loader code and import to the entry point

	return new Miniflare({
		log: new Log(),
		modules: true,
		script,
		unsafeEvalBinding: "UNSAFE_EVAL",
		inspectorPort: 9225,
	});
}
