import { Log, Miniflare } from "miniflare";

export function createMiniflareInstance({
	script,
}: {
	script: string;
}): Miniflare {
	return new Miniflare({
		log: new Log(),
		modules: true,
		script,
		unsafeEvalBinding: "UNSAFE_EVAL",
		inspectorPort: 9225,
	});
}
