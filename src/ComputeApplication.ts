import * as child_process from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import treeKill from 'tree-kill';

import fastlyCliPath from '@fastly/cli';

export type ComputeApplicationStartOptions = {
  addr?: string;

  appRoot?: string;
  startCommand?: string;

  startTimeoutMsecs?: number;
};

export type OutputChunk = {
  content: string;
  type: 'stdout' | 'stderr';
};

export default class ComputeApplication {

  private url?: URL;
  private serverProcess?: child_process.ChildProcess;

  public async start(startOptions?: ComputeApplicationStartOptions) {

    if (this.serverProcess != null) {
      throw new Error('Already started', { cause: this });
    }

    // Three modes:

    // 1. startCommand - switch to appRoot if specified, and run the command. addr + port are not used
    // 2. appRoot only - switch to appRoot and run fastly compute serve. run fastly compute serve with addr + port
    // 3. neither - refer to a running Compute app. addr + port are used to refer to app. This can even be remote.

    // 1 & 2 use a child process, we use child_process.spawn with shell: true and cwd set to appRoot, and that gets shut
    // down when the current process dies. If the app dies first then we throw an error
    // 3 doesn't attempt to shut anything down because we attach to a running instance.

    // 1 & 2 need to detect app having started
    // we can do this by using three modes
    // 1. fastly compute serve - look for "Running local server" then "INFO: Command output:" then "INFO Listening on http://127.0.0.1:7676"
    //    works for --verbose, --quiet, or neither
    // 2. repeated requests - try to request "http://127.0.0.1:7676/" with a short timeout for first byte until we get a response
    // 3. timeout - just wait for a specified time (can even be 0)

    this.url = new URL(startOptions?.addr ?? 'http://127.0.0.1:7676/');

    if (startOptions?.appRoot != null || startOptions?.startCommand != null) {
      const { hostname, port } = this.url;

      const startCommand = startOptions.startCommand ?? `${fastlyCliPath} compute serve --addr="${hostname}:${port}"`;

      const appRoot = startOptions.appRoot ?? './';

      // Calculate the effective "app root".
      // appRoot is provided as either the directory (absolute or relative to current working directory of the
      // current process) to set as the working directory when starting the development environment (the directory
      // in which to run startCommand), or the path to a file in that directory. It may be provided as a path or a
      // file url.

      let effectiveAppRoot = appRoot;
      if (effectiveAppRoot.startsWith('file://')) {
        effectiveAppRoot = url.fileURLToPath(effectiveAppRoot);
      }
      effectiveAppRoot = path.resolve(effectiveAppRoot);
      let stat = fs.statSync(effectiveAppRoot);
      if (!stat.isDirectory()) {
        effectiveAppRoot = path.dirname(effectiveAppRoot);
        stat = fs.statSync(effectiveAppRoot);
        if (!stat.isDirectory()) {
          return Promise.reject(new Error(`Specified appRoot '${appRoot}' is not a directory.`));
        }
      }

      const spawnedProcess = child_process.spawn(startCommand, {
        cwd: effectiveAppRoot,
        shell: true,
      });

      this.serverProcess = spawnedProcess;

      const outputChunks: OutputChunk[] = [];

      spawnedProcess.stderr.on('error', (m: any) => {
        const content = m instanceof Buffer ? m.toString('utf-8') : String(m);
        outputChunks.push({
          content,
          type: 'stderr',
        });
      });

      spawnedProcess.stdout.on('data', (m: any) => {
        const content = m instanceof Buffer ? m.toString('utf-8') : String(m);
        outputChunks.push({
          content,
          type: 'stdout',
        });
      });

      await new Promise((resolve, reject) => {

        let resolved = false;

        const startupTimeout = setTimeout(async () => {
          await throwError(new Error('Server start timeout'));
        }, startOptions.startTimeoutMsecs ?? 30000);

        const throwError = async (error: Error) => {
          clearTimeout(startupTimeout);
          for (const chunk of outputChunks) {
            if (chunk.type === 'stdout') {
              console.log(chunk.content);
            } else {
              console.error(chunk.content);
            }
          }
          reject(error);
          await this.shutdown();
        }

        spawnedProcess.on('error', async (e) => {
          if (!resolved) {
            await throwError(new Error('Server process error', { cause: e }));
          }
        });

        spawnedProcess.on('exit', async (n) => {
          if (!resolved) {
            await throwError(new Error(`Server process exited with code ${n}.`));
          }
        });

        spawnedProcess.on('close', async (n) => {
          if (!resolved) {
            await throwError(new Error(`Server process closed with code ${n}.`));
          }
        });

        spawnedProcess.on('disconnect', () => {
          // console.log('Server process disconnect');
        });

        let stage = 0;
        const handler = (m: any) => {
          const asString = String(m);

          // As of this writing (Fastly VLI 10.2.4 / Viceroy 0.6.1), we can detect that
          // the dev environment is now running by checking for these strings in this order.
          if (stage === 0) {
            if (asString.includes('Running local server')) {
              stage = 1;
            }
          }

          if (stage === 1) {
            if (asString.includes('INFO: Command output:')) {
              stage = 2;
            }
          }

          if (stage === 2) {
            if (asString.includes('INFO Listening on')) {
              stage = 3;
            }
          }

          if (stage === 3) {
            spawnedProcess.stdout.off('data', handler);
            clearTimeout(startupTimeout);
            resolved = true;
            resolve(spawnedProcess);
          }
        };
        spawnedProcess.stdout.on('data', handler);
      });
    }
  }

  public async shutdown() {
    const pid = this.serverProcess?.pid;
    if (pid != null) {
      await new Promise<void>(resolve => {
        treeKill(pid, () => {
          resolve();
        });
      })
      this.serverProcess = undefined;
    }
    this.url = undefined;
  }

  public async fetch(
    input: URL | RequestInfo,
    init?: RequestInit | undefined,
  ): Promise<Response> {
    if (this.url == null) {
      throw new Error('ComputeApplication must be started before fetch()', { cause: this });
    }
    let url: URL;
    if (typeof input === 'string') {
      url = new URL(input, this.url);
      input = url.toString();
    } else if (input instanceof Request) {
      url = new URL(input.url);
    } else {
      url = input;
    }
    if (url.hostname !== this.url.hostname) {
      throw new Error('fetch() must be made on same host as ComputeApplication', { cause: this });
    }
    return await fetch(input, init);
  }
}
