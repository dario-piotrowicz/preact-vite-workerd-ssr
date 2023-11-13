import fs from "node:fs";
import path from "node:path";
import { type ViteDevServer } from "vite";
import { createWorkerdViteFunctions } from "workerd-vite-utils";

export function preactWorkerdSSR() {
	return {
		name: "preact-workerd-ssr",
		configureServer(server: ViteDevServer) {
			return () => {
				const { renderApp } = createWorkerdViteFunctions({
					server,
					functions: {
						renderApp: async ({ data, __vite_ssr_dynamic_import__ }) => {
							const entrypointModule = await __vite_ssr_dynamic_import__(
								(data as { entryPoint: string }).entryPoint,
							);
							const body = (entrypointModule as any).render("/");
							return { body };
						},
					},
				});

				server.middlewares.use(async (req, res, next) => {
					if (req.originalUrl !== "/") {
						// the request is not for the root nor the workerd loader, so
						// it's not for us to handle

						// NOTE: this works fine with preact, but in general we want to handle all
						// incoming requests, we need to find a way to discern which requests we need
						// to handle and which we don't (for example we never want to intercept static
						// asset requests!)
						next();
						return;
					}

					console.time("run SSR");

					const url = req.originalUrl;

					try {
						let template = fs.readFileSync(
							path.resolve(".", "index.html"),
							"utf-8",
						);

						template = await server.transformIndexHtml(url, template);

						try {
							const { body } = (await renderApp({
								entryPoint: "./entry-server.jsx",
							})) as { body: string };

							const html = template.replace(`<!--app-html-->`, body);

							res.statusCode = 200;

							res.setHeader("Content-Type", "text/html");
							res.end(html);
						} catch (e: unknown) {
							const errorMessage = e instanceof Error ? e.message : `${e}`;
							res.statusCode = 500;
							res.statusMessage = errorMessage;
							res.end(errorMessage);
							return;
						}
					} catch (e) {
						server.ssrFixStacktrace(e);
						next(e);
					} finally {
						console.timeEnd("run SSR");
					}
				});
			};
		},
	};
}
