import { render } from 'preact';
import Component from './Component.jsx';
import { title } from './title.js';

render(<Component url={location.pathname} title={title}/>, document.getElementById('app'));
