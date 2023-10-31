import fs from "node:fs";
import path from "node:path";
import { IncomingMessage, ServerResponse } from "node:http";
import { createMiniflareInstance } from "./miniflare.js";
import { type ViteDevServer } from "vite";
//@ts-ignore
import workerdBootloader from "./workerdBootloader.js.txt";

export function preactWorkerdSSR() {
  return {
    name: "preact-workerd-ssr",
    configureServer(server: ViteDevServer) {
      return () => {
        const handler = createWorkerdHandler({
          entrypoint: "./entry-server.jsx",
          server
        });

        server.middlewares.use(async (req, res, next) => {
          const notImplemented = true;
          if(notImplemented) {
            next();
            return;
          }
          console.time("run SSR");

          const url = req.originalUrl;

          try {
            let template = fs.readFileSync(
              path.resolve(".", "index.html"),
              "utf-8"
            );

            template = await server.transformIndexHtml(url, template);

            // dispatch request to miniflare
            const ssrResponse = await handler(req);

            // preact specific
            if (ssrResponse.status !== 200) {
              res.statusCode = ssrResponse.status;
              res.statusMessage = ssrResponse.statusText;
              res.end(await ssrResponse.text());
            }

            const body = await ssrResponse.text();
            const html = template.replace(`<!--app-html-->`, body);

            res.statusCode = 200;

            res.setHeader("Content-Type", "text/html");
            res.end(html);
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


function createWorkerdHandler({
  entrypoint,
  server
}: {
  entrypoint: string,
  server: ViteDevServer,
}) {
  console.log('create handler')

  // TODO: figure out how to get hold of Vite's server address
  // server.httpServer.address() is null, likely because the server hasn't started yet
  //console.log('address', config.server.httpServer.address())
  const address = "http://localhost:4567";

  const bootloader = workerdBootloader
    .replace(/VITE_SERVER_ADDRESS/, address)
    .replace(/WORKERD_APP_ENTRYPOINT/, entrypoint)
    .replace(/GENERATE_RESPONSE/, `
            // preact specific bits
            const url = request.url;
            const renderedString = entryPoint.render(url);

            return new Response(renderedString);
            `);

  // create miniflare instance
  // load it with module loader code and import to the entry point

  const mf = createMiniflareInstance({script: bootloader, unsafeEval: "ourUnsafeEval"});

  // this could be in the future replaced with websockets
  server.middlewares.use(async (request, resp, next) => {
    if(!request.url.startsWith('__workerd_loader/')) {
      next();
      return;
    }

    // the request is for the workerd loader so we need to handle it
    const url = new URL(request.url);
    const moduleId = url.searchParams.get('moduleId');
    const moduleCode = server.transformRequest(moduleId);
    resp.writeHead(200, { 'Content-Type': 'text/plain' });
    resp.end(moduleCode);
  });

  return async function workerdRequestHandler(request: IncomingMessage) {
    // TODO: we should support POST requests with body as well
    //       for that we need something along the lines of 
    //       https://github.com/sveltejs/kit/blob/master/packages/kit/src/exports/node/index.js#L8
    return mf.dispatchFetch(request.url, {headers: request.headers, method: request.method || 'GET'});
  }
}