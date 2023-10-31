import { Log, Miniflare } from "miniflare";

export function createMiniflareInstance(options): Miniflare {
    return new Miniflare({
      log: new Log(),
      workers: [
        {
          name: 'worker',
          compatibilityDate: '2023-07-01',
          modules: [
            {
              contents: options.script,
              type: 'ESModule',
              path: 'index.js',
            },
          ],
          //unsafeEval: options.unsafeEval
        },
      ],
    });
  }