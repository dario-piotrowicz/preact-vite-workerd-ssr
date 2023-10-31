import { Log, Miniflare } from "miniflare";

export function createMiniflareInstance({
  script,
  unsafeEvalBinding,
}: {
  script: string;
  unsafeEvalBinding: string;
}): Miniflare {
  return new Miniflare({
    log: new Log(),
    modules: true,
    script,
    unsafeEvalBinding
  });
}
