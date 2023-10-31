import { Log, Miniflare } from "miniflare";

export function createMiniflareInstance({
  script,
  unsafeEval,
}: {
  script: string;
  unsafeEval: string;
}): Miniflare {
  // TODO: pass unsafeEval to miniflare
  return new Miniflare({
    log: new Log(),
    modules: true,
    script,
  });
}
