import { For } from "solid-js";
import { Title, useRouteData } from "solid-start";
import { createServerData$ } from "solid-start/server";
import Counter from "~/components/Counter";

export function routeData() {
	return createServerData$((_, { env }) => {
		const { TEST, TEST_NAMESPACE } = env as {
			TEST: string;
			TEST_NAMESPACE: string;
		};
		return [{ TEST, TEST_NAMESPACE: TEST_NAMESPACE.get("foo") }];
	});
}

export default function Home() {
	const env = useRouteData<typeof routeData>();

	return (
		<main>
			<Title>Hello World</Title>
			<h1>Hello world!</h1>
			<For each={env()}>
				{(entry) => <p>{JSON.stringify(entry, null, 4)}</p>}
			</For>
			<Counter />
			<p>
				Visit{" "}
				<a href="https://start.solidjs.com" target="_blank">
					start.solidjs.com
				</a>{" "}
				to learn how to build SolidStart apps.
			</p>
		</main>
	);
}
