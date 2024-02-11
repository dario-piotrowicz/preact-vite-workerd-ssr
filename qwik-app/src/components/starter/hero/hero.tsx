import { component$ } from "@builder.io/qwik";
import styles from "./hero.module.css";
import ImgThunder from "~/media/thunder.png?jsx";
import { useShowEnvEntriesLoader } from "~/routes/layout";

export default component$(() => {
  const envEntriesSignal = useShowEnvEntriesLoader();
  return (
    <div class={["container", styles.hero]}>
      <ImgThunder class={styles["hero-image"]} />
      <p>
        {envEntriesSignal.value}
      </p>
    </div>
  );
});
