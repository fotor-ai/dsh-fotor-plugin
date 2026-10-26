/** One cancellable connection owner; activation never waits for human consent. */
import { setTimeout as delay } from 'node:timers/promises';
import { authorize, checkCallbackPort } from './client.mjs';
import { acquireLease } from './lease.mjs';

const owners = new Map();
export function startConnection(connection, { mount, status, authorizeClient = authorize, lease = acquireLease, checkPort = checkCallbackPort, wait = delay, automaticMs = 90000 }) {
  const key = connection.native.env.MCP_REMOTE_CONFIG_DIR + '\n' + connection.native.args[1];
  if (owners.has(key)) throw new Error('Fotor connection already active for this credential directory');
  const controller = new AbortController();
  let releaseLease;
  let child, state = 'preparing', diagnostic;
  const publish = (next, message) => { state = next; diagnostic = message; status(next, message); };
  const owner = { getStatus: () => ({ state, ...(diagnostic ? { diagnostic } : {}) }), dispose };
  owners.set(key, owner);
  publish('preparing');
  const task = Promise.resolve().then(async () => {
    releaseLease = await lease(connection.native.env.MCP_REMOTE_CONFIG_DIR);
    if (controller.signal.aborted) return;
    const checking = Date.now();
    await checkPort(connection.native.args);
    if (controller.signal.aborted) return;
    let remaining = automaticMs - (Date.now() - checking);
    for (let attempt = 0; ; attempt++) {
      const attemptStarted = Date.now();
      try {
        const result = await authorizeClient(connection, { signal: controller.signal, status: publish, automaticMs: Math.max(1, remaining) });
        remaining -= result?.automaticMsUsed ?? Date.now() - attemptStarted;
        break;
      } catch (error) {
        remaining -= Date.now() - attemptStarted;
        const pause = [2000, 5000][attempt];
        if (controller.signal.aborted || !error.transient || attempt === 2 || remaining <= pause) throw error;
        await wait(pause, undefined, { signal: controller.signal });
        remaining -= pause;
      }
    }
    if (controller.signal.aborted) return;
    if (remaining <= 0) throw new Error('Fotor automatic connection budget exceeded');
    child = mount(connection.native);
    // Disposal is registered before awaiting the native handshake.
    let timer;
    try {
      await Promise.race([child.await(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Fotor automatic connection budget exceeded')), Math.max(1, remaining));
      })]);
    } finally { clearTimeout(timer); }
    if (!controller.signal.aborted) publish('connected');
  }).catch(async error => {
    if (!controller.signal.aborted) publish('failed', error.message);
    if (child) await child.dispose();
  });
  let disposed;
  function dispose() {
    return disposed ??= (async () => {
      controller.abort();
      if (child) await child.dispose();
      await task;
      await releaseLease?.();
      if (owners.get(key) === owner) owners.delete(key);
      publish('stopped');
    })();
  }
  return owner;
}
