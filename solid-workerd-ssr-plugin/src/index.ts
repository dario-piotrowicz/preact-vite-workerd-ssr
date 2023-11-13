import { createWorkerdHandler } from "workerd-vite-utils";

export default function (options = {}) {
	return {
		name: "cloudflare-pages",
		async dev(options, vite, dev) {
			const server = vite;

			const handler = createWorkerdHandler({
				entrypoint: "./src/entry-server.tsx",
				server,
				requestHandler: ({ request, entrypointModule }) => {
					return entrypointModule.default({
						request,
					});
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

				const url = req.originalUrl;

				try {
					const ssrResponse = await handler(req);

					if (ssrResponse.status !== 200) {
						res.statusCode = ssrResponse.status;
						res.statusMessage = ssrResponse.statusText;
						res.end(await ssrResponse.text());
						return;
					}

					const body = await ssrResponse.text();
					res.statusCode = 200;
					res.setHeader("Content-Type", "text/html");
					res.end(body);
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
