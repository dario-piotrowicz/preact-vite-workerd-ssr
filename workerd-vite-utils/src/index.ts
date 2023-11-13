import { ViteDevServer } from "vite";
import { instantiateMiniflare } from "./miniflare.js";

import { Miniflare, Request as MiniflareRequest } from "miniflare";

export type JSONValue =
	| string
	| number
	| boolean
	| { [x: string]: JSONValue }
	| Array<JSONValue>;

type WorkerdFunction<
	T extends JSONValue = JSONValue,
	U extends JSONValue = JSONValue,
> = (data: T) => Promise<U>;

type WorkerdFunctions = Record<string, WorkerdFunction>;

export type WorkerdFunctionImplementation<
	T extends JSONValue,
	U extends JSONValue,
> = (opts: {
	// user data (practically the fn args)
	data: T;

	// miniflare/workerd values
	req: MiniflareRequest;
	env: Record<string, unknown>;
	ctx: { waitUntil: (p: Promise<unknown>) => void };

	// vite modules resolution functions
	// Note: we do want to provide this to the handler so that users aren't forced
	//       to ts-ignore such imports
	__vite_ssr_import__: (moduleId: string) => Promise<unknown>;
	__vite_ssr_dynamic_import__: (moduleId: string) => Promise<unknown>;
	// TODO: fill the types here
	// __vite_ssr_exports__
	// __vite_ssr_exportAll__
	// __vite_ssr_import_meta__
}) => U | Promise<U>;

export type WorkerdFunctionImplementations = Record<
	string,
	WorkerdFunctionImplementation<JSONValue, JSONValue>
>;

// TODO: improve the WorkerdFunctionImplementations and WorkerdFunctions types (make them generic etc...)
export function createWorkerdViteFunctions(opts: {
	server: ViteDevServer;
	functions: WorkerdFunctionImplementations;
}): WorkerdFunctions {
	const { server } = opts;

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

		// searchParams.get strips "+" characters which affects module resolution
		const moduleId = url.searchParams.get("moduleId").replace(/ /g, "+");

		const moduleCode = (
			await server.transformRequest(moduleId, {
				ssr: true,
			})
		).code;

		resp.writeHead(200, { "Content-Type": "text/plain" });

		// console.log(`\x1b[46mresult:\n\n${moduleCode}\n\n\x1b[0m`);

		resp.end(moduleCode);
	});

	return Object.keys(opts.functions).reduce((acc, functionName) => {
		return {
			...acc,
			[functionName]: getWorkerdFn(functionName),
		};
	}, {} as WorkerdFunctions);

	function getWorkerdFn(functionName: string): WorkerdFunction {
		return async (data: JSONValue): Promise<JSONValue> => {
			if (!mf) {
				// this check is here as a precaution, it should never happen
				// that at this point miniflare is not initialized!
				throw new Error("miniflare not initialized!");
			}

			const request = new MiniflareRequest("http://localhost", {
				headers: {
					__workerd_vite_runner_fn_name: functionName,
					__workerd_vite_runner_data__: JSON.stringify(data),
				},
			});

			const resp = await mf.dispatchFetch(request);
			const text = await resp.text();
			if (!resp.ok) {
				throw new Error(text);
			}
			const result: JSONValue = JSON.parse(text);
			return result;
		};
	}
}
