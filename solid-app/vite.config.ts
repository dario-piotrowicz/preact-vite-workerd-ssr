import solid from "solid-start/vite";
import { defineConfig } from "vite";
// import cloudflare from "solid-start-cloudflare-pages"; // old adapter
import cloudflare from "solid-workerd-ssr-plugin"; // new adapter

export default defineConfig({
  plugins: [solid({ adapter: cloudflare({}) })],
});
