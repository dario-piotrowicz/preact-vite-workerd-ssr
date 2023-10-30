import fs from "node:fs";
import path from "node:path";
import { createMiniflareInstance } from "./miniflare.js";
import { getWorkerdLoadModule } from "./workerdLoadModule.js";
import { type ViteDevServer } from "vite";
import { Miniflare } from "miniflare";

export function workerdSSR() {
  return {
    name: "workerd-ssr",
    configureServer(server: ViteDevServer) {
      //const workerdLoadModule = getWorkerdLoadModule(server, mf);
      const handler = createWorkerdHandler({entry: "./entry-server.jsx"
                                            server});

      return () => {
        server.middlewares.use(async (req, res, next) => {
          console.time("run SSR");

          const url = req.originalUrl;

          try {
            let template = fs.readFileSync(
              path.resolve(".", "index.html"),
              "utf-8"
            );

            template = await server.transformIndexHtml(url, template);

            // preact specific
            //  new response object to response the html from the app
            const bufferResponse = Response();

            //const { render } = await workerdLoadModule("./entry-server.jsx");
            //const appHtml = await render(url);

            // to be shared across all framework
            
            await handler(req, bufferResponse);
            
            
            // preact specific
            const body = bufferResponse.body();
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

  const bootloader = fs.readFileSync('./workerdBootloader.js')
    .replace(/VITE_SERVER_ADDRESS/, (config.server as ViteDevServer).httpServer.address)
    .replace(/WORKERD_APP_ENTRYPOINT/, config.entry)
    .replacE(/GENERATE_RESPONSE/, `
            // preact specific bits
            const url = request.url;
            const renderedString = entryPoint.render(url);

            return new Response(renderedString);
            `);


  // create miniflare instance
  // load it with module loader code and import to the entry point

  const mf = createMiniflareInstance({script: bootloader, unsafeEval: ourUnsafeEval});

  // this could be in the future replaced with websockets
  config.server.middleware.use(async (request, resp, next) => {
    if (request.url.startWith('___workerd_loader/')) {
      const url = new URL(request.url);
      const moduleId = url.searchParams.get('moduleId');
      const moduleCode = config.server.transformRequest(moduleId);
       resp.writeHead(200, { 'Content-Type': 'text/plain' });
       resp.end(moduleCode);
    }
  });

  
  return async function workerdRequestHandler(request, response) {
    // https://nodejs.org/api/http.html#class-httpclientrequest
    // https://nodejs.org/api/http.html#class-httpserverresponse

    /* does this automatically convert from http request to standard request? */
    const resp = await (mf as Miniflare).dispatchFetch(request);

    // TODO:
    // pipe standard response into the provided http response

    // TODO:
    // Promise for when the response is completed
    return true; 
  }
}