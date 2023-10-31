import preactRender from 'preact-render-to-string';
import { h } from 'preact';
import Component from './Component';

const title = await import('./title').then(m => m.title);

export function render(url) {
  return preactRender(Component({ url, title: title + ' (Server Side Rendered!)' }));
}
