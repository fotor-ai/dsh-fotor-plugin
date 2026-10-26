/** Resolve installed resources without persisting machine-specific configuration. */
import { access, readFile, realpath, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ENDPOINT = 'https://mcp.fotor.com/mcp';
export const CALLBACK_HOST = '127.0.0.1';
const execute = promisify(execFile);
export function supportedNode(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  return !!match && ((Number(match[1]) === 24 && Number(match[2]) >= 2) || Number(match[1]) === 26);
}
export function requireValue(condition, message) {
  if (!condition) throw new Error('Fotor configuration: ' + message);
}
export function inputObject(input) {
  requireValue(input !== null && typeof input === 'object' && !Array.isArray(input), 'expected an object');
  return input;
}
async function absoluteResource(value, directory = false) {
  requireValue(typeof value === 'string' && path.isAbsolute(value), 'use an absolute resource path');
  const info = await stat(value).catch(() => null);
  requireValue(info && (directory ? info.isDirectory() : info.isFile()), 'configured resource is missing; preserve the override or remove it to use automatic resolution');
  return value;
}
function serviceUrl(value) {
  const url = new URL(value);
  requireValue(!url.username && !url.password && !url.hash, 'invalid service URL');
  requireValue(url.href === ENDPOINT || (url.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(url.hostname)), 'only production Fotor or a loopback acceptance service is supported');
  return value;
}
export async function resolveSkills(input = {}, options = {}) {
  inputObject(input);
  const packageRoot = options.packageRoot ?? PACKAGE_ROOT;
  requireValue(input.includeDefaultRoots === undefined || input.includeDefaultRoots === false, 'default skill roots must stay disabled');
  const roots = input.customSkillDirs ?? [path.join(packageRoot, 'skills')];
  requireValue(Array.isArray(roots) && roots.length === 1, 'configure one Fotor skill root or remove customSkillDirs for automatic resolution');
  await absoluteResource(roots[0], true);
  return { ...input, providerName: input.providerName ?? 'fotor', includeDefaultRoots: false, customSkillDirs: [...roots], watch: input.watch ?? false };
}
export async function resolveMcp(input = {}, options = {}) {
  inputObject(input);
  const packageRoot = options.packageRoot ?? PACKAGE_ROOT;
  const profileDir = options.profileDir;
  requireValue(typeof profileDir === 'string' && path.isAbsolute(profileDir), 'an active profile is required');
  requireValue(input.transport === undefined || input.transport === 'stdio', 'expected the managed stdio transport');
  requireValue(input.reconnect === undefined || input.reconnect.enabled === false, 'automatic host reconnect must stay disabled');
  const command = input.command ?? process.execPath;
  await absoluteResource(command);
  await access(command, constants.X_OK);
  const version = command === process.execPath ? process.versions.node : (await execute(command, ['--version'], { timeout: 5000, env: childEnvironment({}) })).stdout.trim().replace(/^v/, '');
  requireValue(supportedNode(version), 'use stable Node 24.2.0 or later in 24.x, or Node 26.x');
  const suppliedArgs = input.args;
  requireValue(suppliedArgs === undefined || (Array.isArray(suppliedArgs) && suppliedArgs.length >= 2 && suppliedArgs.every(value => typeof value === 'string')), 'args must be a complete bridge argument array');
  const proxy = suppliedArgs?.[0] ?? path.join(path.dirname(createRequire(path.join(packageRoot, 'package.json')).resolve('mcp-remote/package.json')), 'dist/proxy.js');
  await absoluteResource(proxy);
  requireValue(path.basename(proxy) === 'proxy.js', 'expected the mcp-remote proxy entry');
  const bridgeRoot = path.dirname(path.dirname(await realpath(proxy)));
  const manifest = JSON.parse(await readFile(path.join(bridgeRoot, 'package.json'), 'utf8'));
  requireValue(manifest.name === 'mcp-remote' && manifest.version === '0.15.2', 'expected installed mcp-remote 0.15.2');
  const client = path.join(bridgeRoot, 'dist/client.js');
  await absoluteResource(client);
  const endpoint = serviceUrl(suppliedArgs?.[1] ?? input.endpoint ?? ENDPOINT);
  const callbackPort = input.callbackPort ?? 3335;
  requireValue(Number.isInteger(callbackPort) && callbackPort > 0 && callbackPort < 65536, 'invalid callback port');
  const args = suppliedArgs ? [...suppliedArgs] : [proxy, endpoint, String(callbackPort), '--host', CALLBACK_HOST, '--transport', 'http-only', '--resource', endpoint, '--auth-timeout', '600', '--connect-timeout', '20', '--headers-timeout', '20', '--body-timeout', '20'];
  requireValue(!args.some(value => ['--allow-http', '--skip-resource-parameter', '--debug'].includes(value)), 'unsafe or sensitive-output bridge option');
  const option = name => args[args.indexOf(name) + 1];
  requireValue(args.includes('--resource') && option('--resource') === endpoint, 'preserve the MCP resource parameter');
  requireValue(!args.includes('--host') || option('--host') === CALLBACK_HOST, 'callback must stay on the loopback host');
  const env = { ...inputObject(input.env ?? {}) };
  requireValue(Object.values(env).every(value => typeof value === 'string'), 'environment values must be strings');
  requireValue(env.NODE_TLS_REJECT_UNAUTHORIZED !== '0', 'TLS verification must stay enabled');
  env.MCP_REMOTE_CONFIG_DIR ??= path.join(profileDir, 'fotor', 'mcp-auth');
  requireValue(path.isAbsolute(env.MCP_REMOTE_CONFIG_DIR), 'the credential directory must be absolute');
  const relative = path.relative(packageRoot, env.MCP_REMOTE_CONFIG_DIR);
  requireValue(relative.startsWith('..' + path.sep) || path.isAbsolute(relative), 'credentials must be outside the installed package');
  const cwd = await absoluteResource(input.cwd ?? options.cwd ?? profileDir, true);
  const { endpoint: _endpoint, callbackPort: _callback, ...nativeInput } = input;
  return {
    client,
    native: { ...nativeInput, transport: 'stdio', serverName: input.serverName ?? 'fotor', command, args, env, cwd,
      toolCallTimeoutMs: input.toolCallTimeoutMs ?? 25000, failOnStartupError: input.failOnStartupError ?? true, reconnect: { ...input.reconnect, enabled: false } },
  };
}
/** Share desktop routing, but never copy ambient account credentials into the child. */
export function childEnvironment(extra) {
  const keys = ['PATH', 'HOME', 'USER', 'LOGNAME', 'LANG', 'LC_ALL', 'DISPLAY', 'WAYLAND_DISPLAY', 'DBUS_SESSION_BUS_ADDRESS', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CURRENT_DESKTOP', 'DESKTOP_SESSION', 'BROWSER', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS'];
  return { ...Object.fromEntries(keys.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]])), ...extra };
}
