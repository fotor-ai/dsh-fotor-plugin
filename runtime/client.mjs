/** Bound the pinned bridge CLI without exposing its OAuth output or token files. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { childEnvironment } from './config.mjs';

export function toolsDiscovered(text) {
  const marker = text.indexOf('Tools:');
  if (marker < 0) return false;
  const start = text.indexOf('{', marker);
  if (start < 0) return false;
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { const value = JSON.parse(text.slice(start, index + 1)); return Array.isArray(value.tools) && value.tools.every(tool => typeof tool.name === 'string'); }
      catch { return false; }
    }
  }
  return false;
}
export async function checkCallbackPort(args) {
  if (!/^\d+$/.test(args[2] ?? '')) return;
  const port = Number(args[2]);
  const hostIndex = args.indexOf('--host');
  const host = hostIndex < 0 ? 'localhost' : args[hostIndex + 1];
  await new Promise((resolve, reject) => {
    const probe = createServer(socket => socket.destroy());
    probe.once('error', () => reject(new Error('Fotor callback port is unavailable; stop the conflicting task before retrying')));
    probe.listen({port, host, exclusive:true}, () => probe.close(resolve));
  });
}
export function authorize(connection, { signal, status, automaticMs = 90000, humanMs = 600000, spawnProcess = spawn } = {}) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('Fotor connection cancelled'));
    const config = connection.native;
    const child = spawnProcess(config.command, [connection.client, ...config.args.slice(1)], {
      cwd: config.cwd, env: childEnvironment(config.env), stdio: ['pipe', 'pipe', 'pipe'], shell: false,
    });
    let output = '', waiting = false, waited = false, failure, killTimer;
    let started = Date.now(), remaining = automaticMs;
    const finish = error => { failure ??= error; child.kill('SIGTERM'); killTimer ??= setTimeout(() => child.kill('SIGKILL'), 1500); };
    const aborted = () => finish(new Error('Fotor connection cancelled'));
    signal.addEventListener('abort', aborted, { once: true });
    let timer = setTimeout(() => finish(new Error('Fotor automatic connection budget exceeded')), remaining);
    const receive = chunk => {
      output += chunk.toString('utf8');
      if (Buffer.byteLength(output) > 1024 * 1024) return finish(new Error('Fotor bridge output exceeded its bound'));
      if (/EADDRINUSE|address already in use/i.test(output)) return finish(new Error('Fotor callback port is already in use; stop the conflicting task or preserve and adjust its explicit configuration'));
      if (/Could not open a browser automatically/.test(output)) return finish(new Error('Fotor browser unavailable; configure the ordinary browser before retrying'));
      if (!waited && /Please authorize this client by visiting:|Authentication required\. Waiting for authorization/.test(output)) {
        remaining = Math.max(1, remaining - (Date.now() - started));
        clearTimeout(timer); waiting = true; waited = true;
        status('waiting-authorization');
        timer = setTimeout(() => finish(new Error('Fotor authorization wait expired')), humanMs);
      }
      if (waiting && /Connected successfully!/.test(output)) {
        waiting = false; started = Date.now(); clearTimeout(timer);
        timer = setTimeout(() => finish(new Error('Fotor automatic connection budget exceeded')), remaining);
        status('preparing');
      }
    };
    child.stdout.on('data', receive); child.stderr.on('data', receive);
    child.on('error', () => { failure = new Error('Fotor authorization client could not start'); });
    child.on('close', code => {
      clearTimeout(timer); clearTimeout(killTimer); signal.removeEventListener('abort', aborted);
      const discovered = toolsDiscovered(output);
      const connected = /Connected successfully!/.test(output);
      const transient = !waited && /EAI_AGAIN|ENOTFOUND|ECONNRESET|ETIMEDOUT|ECONNREFUSED/.test(output);
      output = '';
      if (failure) reject(failure);
      else if (code === 0 && connected && discovered) resolve({ automaticMsUsed: automaticMs - remaining + (waiting ? 0 : Date.now() - started) });
      else {
        const error = new Error(waited ? 'Fotor authorization did not complete; disable and enable MCP to try again' : 'Fotor client did not connect and discover tools');
        error.transient = transient; reject(error);
      }
    });
  });
}
