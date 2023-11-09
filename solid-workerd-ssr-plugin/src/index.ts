import fs from "node:fs";
import path from "node:path";
import { type ViteDevServer } from "vite";
import { createWorkerdHandler } from "workerd-vite-utils";

export default function (options = {}) {
	return {
		name: "cloudflare-pages",
		async dev(options, vite, dev) {
			const server = vite;

			const handler = createWorkerdHandler({
				entrypoint: "./src/entry-server.tsx",
				server,

				// frameworkRequestHandlingJs: `
				//   const resp = entryPoint.default();
				//   return new Response(resp);
				// `,

				frameworkRequestHandlingJs: `
				  const resp = await entryPoint.default({
				    request,
				    env: {},
				    clientAddress: request.socket.remoteAddress,
				    locals: {}
				  });

				  return resp;
				`,
			});

			return async (req, res, next) => {
				if (req.originalUrl !== "/") {
					// the request is not for the root nor the workerd loader, so
					// it's not for us to handle

					// NOTE: this works fine with preact, but in general we want to handle all
					// incoming requests, we need to find a way to discern which requests we need
					// to handle and which we don't (for example we never want to intercept static
					// asset requests!)
					console.log("WOULD RETURN");
					next();
					return;
				}

				console.time("run SSR");

				const url = req.originalUrl;

				try {
					// template = await server.transformIndexHtml(url, template);

					const ssrResponse = await handler(req);
					// console.log("SSR RESPONSE");
					// console.log(ssrResponse);

					if (ssrResponse.status !== 200) {
						res.statusCode = ssrResponse.status;
						res.statusMessage = ssrResponse.statusText;
						res.end(await ssrResponse.text());
						return;
					}

					const body = await ssrResponse.text();

					res.statusCode = 200;

					res.setHeader("Content-Type", "text/html");

					console.log("SENDING SSR HTML");
					res.end(body);
				} catch (e) {
					console.log("ERROR DURING SSR");
					server.ssrFixStacktrace(e);
					next(e);
				} finally {
					console.timeEnd("run SSR");
				}
			};

			// const mf = new Miniflare({
			//   script: `
			//   export default {
			//     fetch: async (request, env) => {
			//       return await serve(request, env, globalThis);
			//     }
			//   }
			//   export const WebSocketDurableObject = WebSocketDurableObject1;
			// `,
			//   globals: {
			//     WebSocketDurableObject1: class DO {
			//       state;
			//       env;
			//       promise;
			//       constructor(state, env) {
			//         this.state = state;
			//         this.env = env;
			//         this.promise = this.createProxy(state, env);
			//       }
			//       async createProxy(state, env) {
			//         const { WebSocketDurableObject } = await vite.ssrLoadModule("~start/entry-server");
			//         return new WebSocketDurableObject(state, env);
			//       }
			//       async fetch(request) {
			//         console.log("DURABLE_OBJECT", request.url);
			//         try {
			//           let dObject = await this.promise;
			//           return await dObject.fetch(request);
			//         } catch (e) {
			//           console.log("error", e);
			//         }
			//       }
			//     },
			//     serve: async (req, e, g) => {
			//       const {
			//         Request,
			//         Response,
			//         fetch,
			//         crypto,
			//         Headers,
			//         ReadableStream,
			//         WritableStream,
			//         WebSocketPair,
			//         TransformStream
			//       } = g;
			//       Object.assign(globalThis, {
			//         Request,
			//         Response,
			//         fetch,
			//         crypto,
			//         Headers,
			//         ReadableStream,
			//         WritableStream,
			//         TransformStream,
			//         WebSocketPair
			//       });
			//       console.log(
			//         "🔥",
			//         req.headers.get("Upgrade") === "websocket" ? "WEBSOCKET" : req.method,
			//         req.url
			//       );
			//       if (req.headers.get("Upgrade") === "websocket") {
			//         const url = new URL(req.url);
			//         console.log(url.search);
			//         const durableObjectId = e.DO_WEBSOCKET.idFromName(url.pathname + url.search);
			//         const durableObjectStub = e.DO_WEBSOCKET.get(durableObjectId);
			//         const response = await durableObjectStub.fetch(req);
			//         return response;
			//       }
			//       try {
			//         // JC: This seem to be where we'd want to `createWorkerdHandler`
			//         return await dev.fetch({
			//           request: req,
			//           env: e,
			//           clientAddress: req.headers.get("cf-connecting-ip"),
			//           locals: {}
			//         });
			//       } catch (e) {
			//         console.log("error", e);
			//         return new Response(e.toString(), { status: 500 });
			//       }
			//     }
			//   },
			//   modules: true,
			//   kvPersist: true,
			//   ...miniflareOptions
			// });
			// console.log("🔥", "starting miniflare");
			// return await createServer(vite, mf, {});
		},

		start(config, { port }) {
			console.log("DOING NOTHING FROM ADAPTER START");
		},

		async build(config, builder) {
			console.log("DOING NOTHING FROM ADAPTER BUILD");
		},
	};
}

// export function solidWorkerdSSR() {
// 	return {
// 		name: "solid-workerd-ssr",
// 		configureServer(server: ViteDevServer) {
// 			console.log("USING THE NEW ADAPTER");

// 			return () => {
// 				if (server === null || server.httpServer === null) return;
// 				server.httpServer.once("listening", () => {
// 					const handler = createWorkerdHandler({
// 						entrypoint: "./entry-server.jsx",
// 						server,
// 						frameworkRequestHandlingJs: `
// 				      const url = request.url;
// 				      const renderedString = entryPoint.render(url);

// 				      return new Response(renderedString);
// 				    `,
// 					});

// 					server.middlewares.use(async (req, res, next) => {
// 						if (req.originalUrl !== "/") {
// 							// the request is not for the root nor the workerd loader, so
// 							// it's not for us to handle

// 							// NOTE: this works fine with preact, but in general we want to handle all
// 							// incoming requests, we need to find a way to discern which requests we need
// 							// to handle and which we don't (for example we never want to intercept static
// 							// asset requests!)
// 							next();
// 							return;
// 						}

// 						console.time("run SSR");

// 						const url = req.originalUrl;

// 						try {
// 							let template = fs.readFileSync(
// 								path.resolve(".", "index.html"),
// 								"utf-8",
// 							);

// 							template = await server.transformIndexHtml(url, template);

// 							const ssrResponse = await handler(req);

// 							if (ssrResponse.status !== 200) {
// 								res.statusCode = ssrResponse.status;
// 								res.statusMessage = ssrResponse.statusText;
// 								res.end(await ssrResponse.text());
// 								return;
// 							}

// 							const body = await ssrResponse.text();
// 							const html = template.replace(`<!--app-html-->`, body);

// 							res.statusCode = 200;

// 							res.setHeader("Content-Type", "text/html");
// 							res.end(html);
// 						} catch (e) {
// 							server.ssrFixStacktrace(e);
// 							next(e);
// 						} finally {
// 							console.timeEnd("run SSR");
// 						}
// 					});
// 				});
// 			};
// 		},
// 	};
// }
