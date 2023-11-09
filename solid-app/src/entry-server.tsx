import {
	createHandler,
	renderAsync,
	renderSync,
	render,
	StartServer,
} from "solid-start/entry-server";

export default createHandler(
	renderAsync((event) => <StartServer event={event} />),
);

// export default createHandler(
// 	renderSync((event) => <StartServer event={event} />),
// );

// export default () => {
// 	try {
// 		render(() => <StartServer event={{ request }} />);
// 	} catch (error) {
// 		return error;
// 	}
// };

// export default () => {
// 	return "<body><h1>hello world</h1></body>";
// };
