import { Log, Miniflare } from "miniflare";

export function createMiniflareInstance() {
    return new Miniflare({
      log: new Log(),
      workers: [
        {
          name: 'worker',
          compatibilityDate: '2023-07-01',
          modules: [
            {
              contents: `
                export default {
                  async fetch(request, env, ctx) {
                    return new Response("")
                  }
                }`,
              type: 'ESModule',
              path: 'index.js',
            },
          ],
        },
      ],
    });
  }