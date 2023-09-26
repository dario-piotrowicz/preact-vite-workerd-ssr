import { render } from 'preact';
import Component from './Component.jsx';

render(<Component url={location.pathname} />, document.getElementById('app'));
