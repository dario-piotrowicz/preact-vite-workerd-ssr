import { createWorkerdViteFunctions } from "workerd-vite-utils";

export default function (options = {}) {
	return {
		name: "cloudflare-pages",
		async dev(options, vite, dev) {
			const server = vite;

			const { renderApp } = createWorkerdViteFunctions({
				server,
				functions: {
					renderApp: async ({ data, req: request, viteImport }) => {
						const entrypointModule = await viteImport(
							(data as { entryPoint: string }).entryPoint,
						);
						const resp = await (entrypointModule as any).default({ request });
						const html = await resp.text();
						return { html };
					},
				},
			});

			return async (req, res, next) => {
				if (req.originalUrl !== "/") {
					// the request is not for the root nor the workerd loader, so
					// it's not for us to handle

					// NOTE: this works fine with solid, but in general we want to handle all
					// incoming requests, we need to find a way to discern which requests we need
					// to handle and which we don't (for example we never want to intercept static
					// asset requests!)
					next();
					return;
				}

				try {
					const { html } = (await renderApp({
						entryPoint: "./src/entry-server.tsx",
					})) as { html: string };

					res.statusCode = 200;
					res.setHeader("Content-Type", "text/html");
					res.end(html);
				} catch (e) {
					server.ssrFixStacktrace(e);
					next(e);
				} finally {
					console.timeEnd("run SSR");
				}
			};
		},

		start(config, { port }) {
			throw new Error("Unimplemented");
		},

		async build(config, builder) {
			throw new Error("Unimplemented");
		},
	};
}
