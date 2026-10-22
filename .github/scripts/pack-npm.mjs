// Release tooling only: excluded from both installed Fotor payloads.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

export const NAME = '@fotor-ai/dsh-fotor-plugin';
export const REPOSITORY = 'https://github.com/fotor-ai/dsh-fotor-plugin';
export const GRAPH_SHA256 = 'a08c09092169f231362bc90565dbc601ba08d1f5ca1599a27f7b51429674b4bf';
export const NPM_VERSION = '11.21.1';
export const NODE_RANGE = '>=24.2.0 <25.0.0 || 26.x';
const ownFiles = ['cordis.patch.yml', 'configuration.example.yml', 'INSTALL.md',
  'skills', 'assets', 'README.md', 'LICENSE'];
const refNames = ['authentication.md', 'credits.md', 'mcp-integration.md', 'media-upload.md'];
const json = p => JSON.parse(fs.readFileSync(p, 'utf8'));
export const sha256 = data => createHash('sha256').update(data).digest('hex');
export const canonical = value => JSON.stringify(sorted(value));
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return value;
}
export function supportedNode(version) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return [major, minor, patch].every(Number.isSafeInteger)
    && ((major === 24 && minor >= 2) || major === 26);
}
export function safePath(name) {
  assert(name && !name.includes('\\') && !name.includes(':') && !/[\x00-\x1f\x7f]/.test(name),
    'Unsafe archive path');
  assert(name.split('/').every(part => part && part !== '.' && part !== '..'),
    'Unsafe archive path');
  return name;
}
export function tree(root) {
  const result = [];
  function visit(dir, prefix) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const relative = prefix + entry.name;
      const full = path.join(dir, entry.name);
      const stat = fs.lstatSync(full);
      assert(!stat.isSymbolicLink(), 'Unexpected symbolic link: ' + relative);
      if (stat.isDirectory()) visit(full, relative + '/');
      else {
        assert(stat.isFile(), 'Unexpected special file: ' + relative);
        result.push({ path: safePath(relative), sha256: sha256(fs.readFileSync(full)), mode: stat.mode & 0o777 });
      }
    }
  }
  visit(root, '');
  return result.sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
export function validateInput(input) {
  const manifest = json(path.join(input, 'package.json'));
  const lock = json(path.join(input, 'package-lock.json'));
  assert.equal(manifest.name, NAME);
  assert.match(manifest.version, /^\d+\.\d+\.\d+(?:-test\.[1-9]\d*)?$/);
  assert.equal(manifest.repository, REPOSITORY);
  assert.equal(manifest.private, true);
  assert.deepEqual(manifest.dependencies, { 'mcp-remote': '0.15.1' });
  assert.deepEqual(manifest.engines, { dsh: '>=0.2.1-rc.2 <0.3.0-0', node: NODE_RANGE });
  assert.deepEqual(manifest.dsh, { bundle: { patch: './cordis.patch.yml' } });
  assert.deepEqual([...manifest.files].sort(), [...ownFiles].sort());
  const allowed = ['name', 'version', 'description', 'author', 'homepage', 'repository',
    'license', 'private', 'engines', 'icon', 'files', 'dsh', 'dependencies'];
  assert(Object.keys(manifest).every(key => allowed.includes(key)), 'Unexpected manifest field');
  assert.equal(lock.lockfileVersion, 3);
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(lock.requires, true);
  assert.deepEqual(Object.keys(lock).sort(), ['lockfileVersion', 'name', 'packages', 'requires', 'version']);
  assert.deepEqual(lock.packages[''], Object.fromEntries(
    ['name', 'version', 'license', 'dependencies', 'engines'].map(key => [key, manifest[key]])));
  const graph = Object.fromEntries(Object.entries(lock.packages).filter(([key]) => key));
  assert.equal(sha256(canonical(graph)), GRAPH_SHA256, 'Dependency lock differs from reviewed graph');
  const releaseFiles = ['.github/workflows/publish-npm.yml',
    '.github/scripts/pack-npm.mjs', '.github/scripts/release-gate.mjs'];
  const files = tree(input);
  for (const item of files) {
    const top = item.path.split('/')[0];
    assert(ownFiles.includes(top) || ['package.json', 'package-lock.json'].includes(item.path)
      || releaseFiles.includes(item.path), 'Unexpected snapshot file: ' + item.path);
    assert.equal(item.mode, 0o644, 'Unexpected owned file mode: ' + item.path);
    if (top !== '.github') {
      assert(!item.path.split('/').includes('node_modules'), 'Dependencies in Git snapshot');
      assert(!/\.(?:m?[jt]s|cjs|py|sh|exe|dll)$/i.test(item.path), 'Executable owned resource');
    }
  }
  for (const name of ['package.json', 'package-lock.json', 'cordis.patch.yml',
    'configuration.example.yml', 'INSTALL.md', 'README.md', 'LICENSE', 'assets/logo.svg']) {
    assert(files.some(item => item.path === name), 'Missing snapshot file: ' + name);
  }
  const skills = files.filter(item => /^skills\/[^/]+\/SKILL\.md$/.test(item.path));
  for (const skill of skills) {
    const prefix = skill.path.slice(0, -'SKILL.md'.length) + 'references/';
    assert.deepEqual(files.filter(item => item.path.startsWith(prefix))
      .map(item => item.path.slice(prefix.length)).sort(), refNames);
    assert.match(fs.readFileSync(path.join(input, prefix, 'authentication.md'), 'utf8'), /^---\nplatform: dsh\n---/);
  }
  return { manifest, lock, graph, files };
}

// Read the actual npm tarball, including PAX paths. No archive is extracted.
export function tarFiles(archive) {
  const bytes = gunzipSync(archive);
  const result = new Map();
  let offset = 0;
  let extended = {};
  const text = (header, start, length) =>
    header.subarray(start, start + length).toString('utf8').replace(/\0.*$/s, '');
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    offset += 512;
    if (header.every(byte => byte === 0)) break;
    const expected = parseInt(text(header, 148, 8).trim(), 8);
    let checksum = 0;
    for (let i = 0; i < 512; i++) checksum += i >= 148 && i < 156 ? 32 : header[i];
    assert.equal(checksum, expected, 'Invalid tar checksum');
    const size = parseInt(text(header, 124, 12).trim() || '0', 8);
    assert(Number.isSafeInteger(size) && size >= 0 && offset + size <= bytes.length, 'Invalid tar size');
    const data = bytes.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;
    const type = text(header, 156, 1);
    if (type === 'x') {
      extended = {};
      let position = 0;
      while (position < data.length) {
        const space = data.indexOf(32, position);
        const length = Number(data.subarray(position, space).toString());
        assert(space > position && Number.isSafeInteger(length) && length > 0 && position + length <= data.length, 'Invalid PAX record');
        const record = data.subarray(space + 1, position + length - 1).toString();
        const equal = record.indexOf('=');
        assert(equal > 0);
        extended[record.slice(0, equal)] = record.slice(equal + 1);
        position += length;
      }
      continue;
    }
    assert(type === '' || type === '0' || type === '5', 'Archive links and special entries are forbidden');
    const prefix = text(header, 345, 155);
    let name = extended.path || (prefix ? prefix + '/' : '') + text(header, 0, 100);
    extended = {};
    name = name.replace(/\/$/, '');
    safePath(name);
    if (type === '5') continue;
    assert(name.startsWith('package/'), 'Unexpected archive root');
    name = name.slice('package/'.length);
    assert(!result.has(name), 'Duplicate archive member: ' + name);
    const mode = parseInt(text(header, 100, 8).trim(), 8);
    assert((mode & ~0o777) === 0, 'Special permission bits in archive');
    result.set(name, { data, mode, sha256: sha256(data) });
  }
  assert(Object.keys(extended).length === 0, 'Unterminated PAX header');
  return result;
}
function inventory(files) {
  return [...files].map(([name, item]) => ({ path: name, sha256: item.sha256, mode: item.mode }))
    .sort((a, b) => a.path.localeCompare(b.path, 'en'));
}
function runNpm(npm, args, cwd, env) {
  const command = /\.[cm]?js$/.test(npm) ? process.execPath : npm;
  const argv = command === process.execPath ? [npm, ...args] : args;
  const result = spawnSync(command, argv, { cwd, env, encoding: 'utf8', timeout: 300_000, maxBuffer: 20 * 1024 * 1024 });
  assert(result.status === 0, 'npm ' + args[0] + ' failed: ' + (result.error?.message || result.stderr || result.stdout));
  return result.stdout.trim();
}
export function verifyPacked(archive, expected, dependencies, manifest) {
  const files = tarFiles(archive);
  const packedManifest = JSON.parse(files.get('package.json')?.data.toString() || '{}');
  assert.deepEqual(packedManifest, manifest, 'Unexpected npm publication manifest');
  const allExpected = new Map([...expected, ...dependencies]);
  allExpected.set('package.json', { sha256: sha256(Buffer.from(JSON.stringify(manifest, null, 2) + '\n')), mode: 0o644 });
  assert.deepEqual([...files.keys()].sort(), [...allExpected.keys()].sort(), 'Missing or extra packed files');
  for (const [name, item] of files) {
    assert.equal(item.sha256, allExpected.get(name).sha256, 'Changed packed file: ' + name);
    assert.equal(item.mode, allExpected.get(name).mode, 'Changed packed permission: ' + name);
  }
  return files;
}
export async function build({ input, output, report, npm = 'npm' }) {
  assert(supportedNode(process.versions.node), 'Use stable Node 24.2.0 or later in 24.x, or Node 26.x');
  assert(!fs.lstatSync(input).isSymbolicLink(), 'Input directory must not be a symbolic link');
  input = fs.realpathSync(input);
  output = path.resolve(output); report = path.resolve(report);
  for (const destination of [output, report]) {
    let current = destination;
    for (;;) {
      try {
        assert(!fs.lstatSync(current).isSymbolicLink(), 'Output path must not contain symbolic links');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  const inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);
  assert(!inside(output, input) && !inside(report, input) && !inside(report, output), 'Outputs and report must be separate from input');
  assert(!fs.existsSync(output) && !fs.existsSync(report), 'Output/report must be new');
  const { manifest, graph, files: sourceFiles } = validateInput(input);
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'fotor-npm-build-'));
  let publishedOutput = false;
  let publishedReport = false;
  try {
    const stage = path.join(temp, 'stage');
    fs.mkdirSync(stage);
    for (const file of sourceFiles.filter(item => !item.path.startsWith('.github/'))) {
      const dest = path.join(stage, file.path);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(path.join(input, file.path), dest);
      fs.chmodSync(dest, file.mode);
      assert.equal(sha256(fs.readFileSync(dest)), file.sha256, 'Snapshot changed while staging');
    }
    const emptyConfig = path.join(temp, 'npmrc');
    fs.writeFileSync(emptyConfig, '');
    const env = Object.fromEntries(['PATH', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy']
      .filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
    Object.assign(env, { HOME: temp, NPM_CONFIG_USERCONFIG: emptyConfig,
      NPM_CONFIG_GLOBALCONFIG: path.join(temp, 'global-npmrc'), NPM_CONFIG_CACHE: path.join(temp, 'cache'),
      NPM_CONFIG_REGISTRY: 'https://registry.npmjs.org/', NPM_CONFIG_IGNORE_SCRIPTS: 'true',
      NPM_CONFIG_AUDIT: 'false', NPM_CONFIG_FUND: 'false' });
    fs.writeFileSync(env.NPM_CONFIG_GLOBALCONFIG, '');
    assert.equal(runNpm(npm, ['--version'], stage, env), NPM_VERSION, 'Unexpected build npm version');
    runNpm(npm, ['ci', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund'], stage, env);
    console.error('Locked installation complete; verifying dependency archives.');
    const dependencyFiles = new Map();
    const dependencyRecords = [];
    for (const [location, entry] of Object.entries(graph).sort()) {
      assert(location.startsWith('node_modules/'));
      safePath(location);
      const dir = path.join(stage, location);
      assert(!fs.lstatSync(dir).isSymbolicLink(), 'Unexpected installed dependency link');
      const actual = json(path.join(dir, 'package.json'));
      assert.equal(actual.version, entry.version, 'Installed dependency version mismatch');
      assert.equal(actual.name, location.split('node_modules/').at(-1), 'Installed dependency name mismatch');
      assert(!entry.hasInstallScript && !actual.scripts?.install && !actual.scripts?.preinstall && !actual.scripts?.postinstall,
        'Unreviewed dependency install hook');
      // npm ci has already fetched and integrity-checked these archives. Reuse only
      // this build's isolated content-addressed cache, never a user's cache.
      const [algorithm, integrity] = entry.integrity.split('-', 2);
      const digest = Buffer.from(integrity, 'base64').toString('hex');
      const cached = path.join(env.NPM_CONFIG_CACHE, '_cacache', 'content-v2', algorithm,
        digest.slice(0, 2), digest.slice(2, 4), digest.slice(4));
      const archive = fs.readFileSync(cached);
      assert.equal(createHash(algorithm).update(archive).digest('base64'), integrity, 'Dependency integrity mismatch');
      const original = tarFiles(archive);
      const licenses = [...original.keys()].filter(name => /(^|\/)(licen[sc]e|copying|notice)(\.|$)/i.test(name));
      assert(licenses.length > 0 || (typeof actual.license === 'string' && actual.license === entry.license),
        'Missing dependency license declaration: ' + actual.name);
      for (const [name, item] of original) {
        const filename = location + '/' + name;
        const installed = path.join(stage, filename);
        assert(fs.lstatSync(installed).isFile() && !fs.lstatSync(installed).isSymbolicLink(), 'Missing dependency resource');
        assert.equal(sha256(fs.readFileSync(installed)), item.sha256, 'Installed dependency resource differs');
        // npm normalizes archive permissions to 0644/0755.
        const mode = item.mode & 0o111 ? 0o755 : 0o644;
        dependencyFiles.set(filename, { sha256: item.sha256, mode });
      }
      dependencyRecords.push({ name: actual.name, version: actual.version, path: location,
        resolved: entry.resolved, integrity: entry.integrity, license: actual.license, licenseFiles: licenses.sort(), licenseSource: licenses.length ? 'upstream license files' : 'package.json#license',
        files: original.size });
    }
    const npmManifest = { ...manifest };
    delete npmManifest.private;
    npmManifest.bundleDependencies = ['mcp-remote'];
    npmManifest.publishConfig = { access: 'public', registry: 'https://registry.npmjs.org/' };
    fs.writeFileSync(path.join(stage, 'package.json'), JSON.stringify(npmManifest, null, 2) + '\n');
    const packed = JSON.parse(runNpm(npm, ['pack', '--ignore-scripts', '--json'], stage, env));
    assert.equal(packed.length, 1);
    const filename = packed[0].filename;
    assert.equal(path.basename(filename), filename);
    const archive = fs.readFileSync(path.join(stage, filename));
    const expected = new Map(sourceFiles.filter(item => !item.path.startsWith('.github/') && item.path !== 'package-lock.json')
      .map(item => [item.path, item]));
    const verified = verifyPacked(archive, expected, dependencyFiles, npmManifest);
    const result = { format_version: 1, name: NAME, version: manifest.version,
      input_sha256: sha256(canonical(sourceFiles)), dependency_graph_sha256: GRAPH_SHA256,
      node: process.versions.node, npm: NPM_VERSION, file: filename,
      sha256: sha256(archive), integrity: 'sha512-' + createHash('sha512').update(archive).digest('base64'),
      dependencies: dependencyRecords, files: inventory(verified) };
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(output); publishedOutput = true;
    fs.writeFileSync(path.join(output, filename), archive, { flag: 'wx', mode: 0o644 });
    fs.mkdirSync(path.dirname(report), { recursive: true });
    fs.writeFileSync(report, JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o644 });
    publishedReport = true;
    return result;
  } catch (error) {
    if (publishedReport) fs.rmSync(report);
    if (publishedOutput) fs.rmSync(output, { recursive: true });
    throw error;
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const key = process.argv[i].replace(/^--/, '');
    assert(['input', 'output', 'report', 'npm'].includes(key) && !args[key] && process.argv[i + 1], 'Invalid argument');
    args[key] = process.argv[i + 1];
  }
  assert(args.input && args.output && args.report, 'Required: --input --output --report [--npm]');
  build(args).then(result => console.log(JSON.stringify({ name: result.name, version: result.version,
    file: result.file, sha256: result.sha256, packages: result.dependencies.length })))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
