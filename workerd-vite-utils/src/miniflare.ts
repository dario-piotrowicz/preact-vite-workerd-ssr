import { Log, Miniflare } from "miniflare";
import type { ViteDevServer } from "vite";
//@ts-ignore
import workerdBootloader from "./workerdBootloader.js.txt";
import type { WorkerdFunctionImplementations } from "./index";

export function instantiateMiniflare({
	server,
	functions,
}: {
	functions: WorkerdFunctionImplementations;
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
		.replace(/__FUNCTIONS__/, () => {
			const result = [
				"const functions = {};",
				...Object.entries(functions).map(([functionName, functionImpl]) => {
					const functionStr = functionImpl.toString();

					if (
						// TODO: here we make the assumption that if the user provides named functions
						// those match the functionName provided, this is not really necessary and we
						// can handle functions named anything, let implement that later
						functionStr.startsWith(`async function ${functionName}(`) ||
						functionStr.startsWith(`function ${functionName}(`)
					) {
						return `
							${functionStr}

							functions["${functionName}"] = ${functionName};
						`;
					}

					// TODO: here we make the assumption that if the user provides named functions
					// those match the functionName provided, this is not really necessary and we
					// can handle functions named anything, let implement that later
					if (functionStr.startsWith(`${functionName}(`)) {
						return `
							function ${functionStr};

							functions["${functionName}"] = ${functionName};
						`;
					}

					return `
						functions["${functionName}"] = ${functionStr};
					`;
				}),
			].join("\n");
			return `\n\n${result}\n\n`;
		});

	// create miniflare instance
	// load it with module loader code and import to the entry point

	return new Miniflare({
		log: new Log(),
		modules: true,
		bindings: {
			TEST: "TEST",
		},
		kvNamespaces: { TEST_NAMESPACE: "test_namespace" },
		script,
		unsafeEvalBinding: "UNSAFE_EVAL",
		inspectorPort: 9225,
	});
}
