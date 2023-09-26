# workerd-ssr
Preact + Vite SSR demo, runnning in `workerd`. 

All you need to do is run `npx vite` and open `http://localhost:5173`. You should see a page which includes the user agent (of your browser). If you view the page source, you'll see that the SSR build happened in `workerd`, and you should see the Cloudflare Workers user agent there.
