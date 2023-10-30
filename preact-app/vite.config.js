import preact from '@preact/preset-vite';
import { workerdSSR } from 'workerd-ssr-plugin';

/** @type {import('vite').UserConfig} */
export default {
  // config options
  ssr: {
    target: 'webworker',
    noExternal: true,
    optimizeDeps: {
      include: ['preact', 'preact-render-to-string'],
    },
  },
  plugins: [preact(), workerdSSR()],
  build: {
    minify: false,
    ssrEmitAssets: true,
  },
};
