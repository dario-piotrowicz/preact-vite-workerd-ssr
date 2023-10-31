import fs from "node:fs";
import path from "node:path";
import http, { ClientRequest, IncomingMessage } from "node:http";
import { createMiniflareInstance } from "./miniflare.js";
import { type ViteDevServer } from "vite";
import workerdBootloader from "./workerdBootloader.js.txt";

export function workerdSSR() {
  return {
    name: "workerd-ssr",
    configureServer(server: ViteDevServer) {
      return () => {
        const handler = createWorkerdHandler({
          entry: "./entry-server.jsx",
          server
        });

        server.middlewares.use(async (req, res, next) => {
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
            if (ssrResponse.statusCode !== 200) {
              res.statusCode = ssrResponse.statusCode;
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


function createWorkerdHandler(config) {
  console.log('create handler')

  // TODO: figure out how to get hold of Vite's server address
  // server.httpServer.address() is null, likely because the server hasn't started yet
  //console.log('address', config.server.httpServer.address())
  const address = "http://localhost:4567";

  const bootloader = workerdBootloader
    .replace(/VITE_SERVER_ADDRESS/, address)
    .replace(/WORKERD_APP_ENTRYPOINT/, config.entry)
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
  config.server.middlewares.use(async (request, resp, next) => {
    if (request.url.startWith('___workerd_loader/')) {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get('moduleId');
      const moduleCode = config.server.transformRequest(moduleId);
       resp.writeHead(200, { 'Content-Type': 'text/plain' });
       resp.end(moduleCode);
    }
  });

  
  return async function workerdRequestHandler(request: IncomingMessage) {
    // TODO: we should support POST requests with body as well
    //       for that we need something along the lines of 
    //       https://github.com/sveltejs/kit/blob/master/packages/kit/src/exports/node/index.js#L8
    return mf.dispatchFetch(request.url, {headers: request.headers, method: request.method || 'GET'});
  }
}