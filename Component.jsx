import './index.css';
export default ({ url } = {}) => (
  <>
    <main>
      <div class="workers-logo"></div>
      <p>
        Welcome! This is a demo of Preact being rendered using SSR with Vite.
        The SSR render runs <i>in workerd</i>, which means it has access to all
        the usual Workers APIs, like <code>navigator.userAgent: </code>
        <code style={{ color: '#2196f3' }}>{navigator.userAgent}</code>
      </p>

      <p>
        It also has access to the page URL, and so can do dynamic routing.This
        page has a URL of <code style={{ color: '#2196f3' }}>{url}</code>
      </p>
      <p>
        Try viewing the source of this page—you'll see that the user agent
        section above reflects workerd
      </p>
    </main>
  </>
);
