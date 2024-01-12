## Compute Application Testing for JavaScript

For those times you want to write JavaScript tests against a Fastly
Compute application.

> NOTE: Your Compute application can be written in any language/framework.
> This library allows you to write end-to-end tests against the
> output of your Compute application.

Start and stop a Fastly Compute application in the
[local testing environment](https://developer.fastly.com/learning/compute/testing/#running-a-local-testing-server)
from your tests and make requests to it.

Use with any test runner and framework.

> NOTE: `@fastly/compute-testing` is provided as a Fastly Labs product. Visit the
> [Fastly Labs](https://www.fastlylabs.com/) site for terms of use.

### Requirements

For local testing, [Fastly CLI](https://developer.fastly.com/learning/tools/cli) is required.

Note that `@fastly/compute-testing` makes no assumptions or dictates on the language used to build the
Compute application. This framework simply starts/stops the application, and helps your code make
HTTP requests to it.

### Installation

```
npm install --save-dev @fastly/compute-testing
```

### Usage

#### Basic usage

The following is a simple example. It uses Node.js's [test runner](https://nodejs.org/api/test.html) along with
Node.js's [assertions](https://nodejs.org/api/assert.html), but note that any test framework or assertion library
can be used.

In your test (`./test.js`), you can start and stop a Compute application:

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Run local Viceroy', function() {

  // Represents the app running in the local development environment
  const app = new ComputeApplication();

  before(async function() {
    // Start the app
    await app.start({
      // Set 'appRoot' to the directory in which to start the app.  This is usually
      // the directory that contains the 'fastly.toml' file.
      appRoot: '/path/to/approot',
      // Optionally set 'addr', which defaults to 'http://127.0.0.1:7676/', it can be
      // used to start the development environment on a different local address or port.
      // addr: 'http://127.0.0.1:7676/'
    });
  });

  it('Response status code is 200', async function() {
    // Make a fetch request to the app. Returns a Promise that resolves to a Response.
    const response = await app.fetch('/');
    assert.equal(response.status, 200);
  });

  it('Response headers include Content-Type: text/html', async function() {
    const response = await app.fetch('/');
    const contentTypeHeaders =
      (response.headers.get('content-type') ?? '')
      .split(',')
      .map(value => value.trim().split(';')[0]);
    assert.ok(contentTypeHeaders.includes('text/html'));
  });

  it('Response body contains <div>Index</div>', async function() {
    const response = await app.fetch('/');
    const text = await response.text();
    assert.ok(text.includes('<div>Index</div>'));
  });

  after(async function() {
    // Shut down the app
    await app.shutdown();
  });

});
```

You would run this using Node.js in test mode:

```
node --test
```

#### Using a relative path for `appRoot`

Often your test suite will live in the same code repository as your Compute application.
In this case, you may find it useful to specify a relative path.

For example, if your test file is at `<repo>/tests/test.js` and your test application's root is at `<repo>/app`,
then you can specify the `appRoot` at the relative path of `../app` as so:
```javascript
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    await app.start({
      appRoot: path.join(__dirname, '../app'),
    });
```

`appRoot` can also be specified as a URL path of a file in your Compute application
directory. So, if you're using Node.js 20.7 or newer you can use
[import.meta.resolve](https://nodejs.org/api/esm.html#importmetaresolvespecifier):
```javascript
    await app.start({
      appRoot: import.meta.resolve('../app/package.json'), // any file in the directory
    });
```

#### Custom start script

The following example is for a Compute application that is started using a
custom startup command.

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Run custom app', function() {

  const app = new ComputeApplication();

  before(async function() {
    this.timeout(30000);
    await app.start({
      // Set 'startCommand' to the command that starts your server.
      startCommand: 'npm run start',
      // Set 'appRoot' to the directory in which to run 'startCommand'.
      appRoot: '/path/to/approot',
    });
  });

  // .. remaining tests

});
```

#### Use an running local or remote Compute application

In addition, rather than spawning an instance of an edge application, you can use this library to send requests to
a Fastly Compute application that is already running on the local development environment, or running on a remote host.

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Use running application', function() {

  const app = new ComputeApplication();

  before(async function() {
    await app.start({
      // Set 'addr' to the hostname and port of the running application.
      // Defaults to 'http://127.0.0.1:7676/'.
      addr: 'https://app.example.com/',
    });
  });
  
  // no shutdown, because you're not actually starting or shutting down an instance.

  // .. remaining tests

});
```

#### Usage with other tools

Note that this library is tool- and framework-agnostic, and thus can be used with any testing helper
tools. The following example shows usage with [JSDOM](https://github.com/jsdom/jsdom), a DOM
testing library for Node.js.

```javascript
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { JSDOM } from 'jsdom';
import { ComputeApplication } from '@fastly/compute-testing';

describe('JSDOM testing', function() {

  // ...Start development environment...
  
  it('DOM node with id="foo" contains "bar"', async function() {
    const response = await app.fetch('/');
    const dom = new JSDOM(await response.text(), {url: response.url});
    const element = dom.window.document.getElementById('foo');
    assert.ok(element.textContent === 'bar');
  });

  // ...Shut down development environment...

});
```

## Issues

If you encounter any non-security-related bug or unexpected behavior, please [file an issue][bug]
using the bug report template.

[bug]: https://github.com/fastly/js-compute-testing/issues/new?labels=bug

### Security issues

Please see our [SECURITY.md](./SECURITY.md) for guidance on reporting security-related issues.

## License

[MIT](./LICENSE).

