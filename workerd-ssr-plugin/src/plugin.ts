import fs from "node:fs";
import path from "node:path";
import { createMiniflareInstance } from "./miniflare.js";
import { getWorkerdLoadModule } from "./workerdLoadModule.js";
import { type ViteDevServer } from "vite";

export function workerdSSR() {
  const mf = createMiniflareInstance();

  return {
    name: "workerd-ssr",
    configureServer(server: ViteDevServer) {
      const workerdLoadModule = getWorkerdLoadModule(server, mf);

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

            const { render } = await workerdLoadModule("./entry-server.jsx");

            const appHtml = await render(url);

            const html = template.replace(`<!--app-html-->`, appHtml);

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
