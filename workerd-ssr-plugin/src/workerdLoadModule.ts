import { type ViteDevServer, type TransformResult } from 'vite';
import { Log, Miniflare, WorkerOptions } from "miniflare";

export function getWorkerdLoadModule(server: ViteDevServer, mf: Miniflare) {
    const loadModule = getLoadModule(server);
    const collectModules = getCollectModules(loadModule);

    return async (name: string) => {
    console.time('load SSR');

    const serverEntry = await loadModule(name);

    const modules = await collectModules(serverEntry);

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
      render: async (url: string) => {
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
  }
};

function getCollectModules(loadModule: LoadModule) {
    return async (entry: Awaited<ReturnType<LoadModule>>) => {
        async function crawlModuleGraph(deps: TransformResult['deps'], seen: Set<string>) {
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
                await crawlModuleGraph(entry.deps, new Set())
            )
        );
        return modules;
    }
}

type LoadModule = (moduleName: string) => Promise<Pick<TransformResult, 'code'|'deps'>>;

function getLoadModule(server: ViteDevServer): LoadModule {
    return async (name: string) => {
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
    };
};