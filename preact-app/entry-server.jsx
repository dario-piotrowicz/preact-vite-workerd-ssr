import preactRender from 'preact-render-to-string';
import { h } from 'preact';
import Component from './Component';

export function render(url) {
  return preactRender(Component({ url }));
}
