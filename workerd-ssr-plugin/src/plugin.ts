import { Log, type WorkerOptions } from 'miniflare';
import fs from 'node:fs';
import path from 'node:path';
import { createMiniflareInstance } from './miniflare.js';

export function workerdSSR() {
  const mf = createMiniflareInstance();

  return {
    name: 'workerd-ssr',
    configureServer(server) {
      async function loadModule(name) {
        const transformed = await server.transformRequest(name, { ssr: true });
        return {
          code: `
          async function anonymous(
            global,
            __vite_ssr_exports__,
            __vite_ssr_import_meta__,
            __vite_ssr_import__,
            __vite_ssr_dynamic_import__,
            __vite_ssr_exportAll__
          ) {
            "use strict";
            ${transformed.code}}
          `,
          deps: transformed.deps,
        };
      }
      return () => {
        Object.assign(server, {
          workerdLoadModule: async (name) => {
            console.time('load SSR');

            const serverEntry = await loadModule(name);

            async function crawlModuleGraph(deps, seen) {
              return (
                await Promise.all(
                  deps
                    .filter((d) => !seen.has(d))
                    .map(async (i) => {
                      seen.add(i);
                      const m = await loadModule(i);
                      const subimports = await crawlModuleGraph(m.deps, seen);
                      return [[i, `export ${m.code}`], ...subimports];
                    })
                )
              ).flat();
            }

            // De-dupe modules
            const modules: [string, string][] = Object.entries(
              Object.fromEntries(
                await crawlModuleGraph(serverEntry.deps, new Set())
              )
            );

            await mf.setOptions({
              log: new Log(),
              workers: [
                {
                  name: 'worker',
                  compatibilityDate: '2023-07-01',
                  modules: [
                    {
                      contents: `
                  import {anonymous} from "./entry-server.js"

                  async function loader(n) {
                    const ssrModule = {}
                    const m = await import(n)

                    await m.anonymous({}, ssrModule, {}, loader, () => {}, () => {})
                    return ssrModule
                  }

                  export default {
                    async fetch(request, env, ctx) {
                      console.log(request.url)
                      const ssrModule = {}
                      await anonymous({}, ssrModule, {}, loader, () => {}, () => {})
                      const url = new URL(request.url)
                      const fn = ssrModule[url.pathname.slice(1)]
                      const res = await fn(...await request.json())
                      return new Response(res)
                    }
                  }`,
                      type: 'ESModule',
                      path: 'index.js',
                    },
                    {
                      contents: `export ${serverEntry.code}`,
                      type: 'ESModule',
                      path: 'entry-server.js',
                    },
                    ...modules.map(([k, v]) => ({
                      contents: v,
                      path: k.slice(1),
                      type: 'ESModule',
                    })) as Exclude<WorkerOptions['modules'], boolean>,
                  ],
                },
              ],
            });
            console.timeEnd('load SSR');

            return {
              render: async (url) => {
                const r = await mf.dispatchFetch('http://localhost/render', {
                  method: 'POST',
                  body: JSON.stringify([url]),
                  headers: {
                    'content-type': 'application/json',
                  },
                });

                return await r.text();
              },
            };
          },
        });
        server.middlewares.use(async (req, res, next) => {
          console.time('run SSR');

          const url = req.originalUrl;

          try {
            let template = fs.readFileSync(
              path.resolve('.', 'index.html'),
              'utf-8'
            );

            template = await server.transformIndexHtml(url, template);

            const { render } = await server.workerdLoadModule(
              './entry-server.jsx'
            );

            const appHtml = await render(url);

            const html = template.replace(`<!--app-html-->`, appHtml);

            res.statusCode = 200;

            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (e) {
            server.ssrFixStacktrace(e);
            next(e);
          } finally {
            console.timeEnd('run SSR');
          }
        });
      };
    },
  };
}
