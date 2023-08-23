## Compute Application Testing for JavaScript

For those times you want to write JavaScript tests against a Fastly
Compute application.

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

The following is a simple example. It uses the [Mocha](https://mochajs.org) test framework
and [Node.js assertions](https://nodejs.org/api/assert.html), but note that any test framework
or assertion library can be used.

In your test, you can start and stop a Compute application:

```javascript
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Run local Viceroy', function() {

  // A variable to represent the app running in the local development environment
  let app;

  before(async function() {
    // We need a few seconds to wait for local development environment to start
    this.timeout(30000);
    // Start the app
    app = await ComputeApplication.start({
      // Set 'appRoot' to the directory in which to start the app.  This is usually
      // the directory that contains the 'fastly.toml' file.
      appRoot: '/path/to/approot',
      // Optionally set 'addr', which defaults to 'http://127.0.0.1:7676/', it can be
      // used to start the development environment on a different local address or port.
      // addr: 'http://127.0.0.1:7676/'
    });
  });

  it('Response body contains <div>Index</div>', async function() {
    // Make a fetch request to the app. Returns a Promise that resolves to a Response.
    const response = await app.fetch('/');
    const text = await response.text();
    assert.ok(text.includes('<div>Index</div>'));
  });

  after(async function() {
    // We need a few seconds to wait for local development environment to stop
    this.timeout(10000);
    // Shut down the app
    await app.shutdown();
    app = null;
  });

});
```

#### Using a relative path for `appRoot`

Often your Compute application will live at a subdirectory of the path that contains your test suite.
In this case, you may find it useful to specify a relative path.

For example, if your test file is at `/tests/test.js` and your test application's root is at `/tests/app`,
then you can specify the `appRoot` at the relative path of `./app` as so:
```javascript
    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    await app.start({
      appRoot: path.join(__dirname, './app'),
    });
```

`appRoot` can also be specified as a URL path of a file in your Compute application
directory. So, if you're using Node.js 20.7 or newer you can use
[import.meta.resolve](https://nodejs.org/api/esm.html#importmetaresolvespecifier):
```javascript
    await app.start({
      appRoot: import.meta.resolve('./app/package.json'), // any file in the directory
    });
```

#### Custom start script

The following example is for a Compute application that is started using a
custom startup command.

```javascript
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Run custom app', function() {

  let app;

  before(async function() {
    this.timeout(30000);
    app = await ComputeApplication.start({
      // Set 'startCommand' to the command that starts your server.
      startCommand: 'npm run start',
      // Set 'appRoot' to the directory in which to run 'startCommand'.
      appRoot: '/path/to/approot',
    });
  });

  // .. remaining tests

});
```

#### Use an already-running or remote Compute application

The following example is for a Fastly Compute application that is already running, or
running on a remote host.

```javascript
import assert from 'node:assert';
import path from 'node:path';
import url from 'node:url';

import { ComputeApplication } from '@fastly/compute-testing';

describe('Use running application', function() {

  let app;

  before(async function() {
    app = await ComputeApplication.start({
      // Set 'addr' to the hostname and port of the running application.
      // Defaults to 'http://127.0.0.1:7676/'.
      addr: 'https://app.example.com/',
    });
  });

  // .. remaining tests

});
```

#### Usage with other tools

Note that this library is tool- and framework-agnostic, and thus can be used with any testing helper
tools. The following example shows usage with [JSDOM](https://github.com/jsdom/jsdom), a DOM
testing library for Node.js.

```javascript
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

