import { component$, useStyles$ } from "@builder.io/qwik";
import styles from "./styles.css?inline";

export default component$(() => {
  useStyles$(styles);
  return (
    <button onClick$={() => alert('clicked')} class="dario-wip-message">This is the start of the body, below there's only <code>&lt;RouterOutlet /&gt;</code> 👇</button>
    // Note: nothing gets rendered below here indicating that RouterOutlet does not get all the info it needs
  );
});
