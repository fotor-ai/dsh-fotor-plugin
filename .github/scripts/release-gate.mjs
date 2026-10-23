// Publication controls; never installed or invoked by the Fotor Bundle.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { NAME, REPOSITORY, GRAPH_SHA256, NPM_VERSION, canonical, tarFiles, sha256 } from './pack-npm.mjs';

const repo = 'fotor-ai/dsh-fotor-plugin';
const registry = 'https://registry.npmjs.org/';
const WAIT_MS = 600_000;
const POLL_MS = 15_000;
const REQUEST_MS = 30_000;
const versionPattern = /^\d+\.\d+\.\d+(?:-test\.[1-9]\d*)?$/;

class Processing extends Error {
  constructor(message, retryAfter = 0) { super(message); this.retryAfter = retryAfter; }
}
export class PublicationPending extends Error {
  constructor(reason, commandExitCode) {
    super('Publication remains unconfirmed after the read-only deadline: ' + reason);
    this.result = { status: 'pending', reason, publish_exit_code: commandExitCode, retry_publish: false };
  }
}
function runtime(dependencies = {}) {
  return { now: () => performance.now(), wallNow: Date.now,
    sleep: ms => new Promise(resolve => setTimeout(resolve, ms)), fetch: globalThis.fetch,
    timeoutSignal: ms => AbortSignal.timeout(Math.max(1, Math.ceil(ms))),
    log: value => console.error(JSON.stringify(value)), ...dependencies };
}
function remaining(rt, deadline) {
  const value = deadline - rt.now();
  if (value <= 0) throw new Processing('verification deadline reached');
  return value;
}
function registryURL(value) {
  const url = new URL(value);
  assert.equal(url.origin, registry.slice(0, -1), 'Unexpected registry origin');
  assert(!url.username && !url.password && !url.hash, 'Unexpected registry URL credentials or fragment');
  return url.href;
}
function retryAfter(response, rt) {
  const value = response.headers.get('retry-after');
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value) * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - rt.wallNow()) : 0;
}
async function readRegistry(url, rt, deadline, { absentAllowed = false, bytes = false } = {}) {
  const timeout = Math.min(REQUEST_MS, remaining(rt, deadline));
  try {
    const response = await rt.fetch(registryURL(url), { method: 'GET', redirect: 'error',
      headers: { 'Cache-Control': 'no-cache', Accept: bytes ? 'application/octet-stream' : 'application/json' },
      signal: rt.timeoutSignal(timeout) });
    if (response.status === 404) {
      if (absentAllowed) return undefined;
      throw new Processing('registry resource not yet available');
    }
    if (response.status === 429 || (response.status >= 500 && response.status < 600)) {
      throw new Processing('temporary registry HTTP ' + response.status, retryAfter(response, rt));
    }
    assert(response.ok, 'Registry check failed: ' + response.status);
    const result = bytes ? Buffer.from(await response.arrayBuffer()) : await response.json();
    remaining(rt, deadline);
    return result;
  } catch (error) {
    if (error instanceof Processing) throw error;
    const transient = ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ECONNREFUSED',
      'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET'];
    if (['AbortError', 'TimeoutError'].includes(error.name) || transient.includes(error.cause?.code || error.code)) {
      throw new Processing('temporary registry transport failure');
    }
    throw error;
  }
}
export function validateStableRelease({ version, sha, tagType, tagCommit, release }) {
  assert.equal(tagType, 'tag', 'Expected an annotated release Tag');
  assert.equal(tagCommit, sha, 'Tag and publication commit differ');
  assert(!release.draft && !release.prerelease && release.tag_name === 'v' + version,
    'Expected matching published stable GitHub Release');
}
export function assertVersionAvailable(metadata, version) {
  assert(!metadata?.versions?.[version], 'npm version already exists; inspect registry instead of overwriting');
}
export function validateSelection({ version, channel, ref, repository, sha }) {
  assert.equal(repository, repo, 'Wrong publication repository');
  assert.match(sha, /^[a-f0-9]{40}$/, 'Expected full source commit');
  if (channel === 'next') {
    assert.equal(ref, 'refs/heads/release/test', 'next requires release/test');
    assert.match(version, /^\d+\.\d+\.\d+-test\.[1-9]\d*$/);
  } else {
    assert.equal(channel, 'latest', 'Unknown npm channel');
    assert.equal(ref, 'refs/heads/main', 'latest requires main');
    assert.match(version, /^\d+\.\d+\.\d+$/);
  }
}
function command(name, args, rt, deadline) {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout: Math.ceil(Math.min(REQUEST_MS, remaining(rt, deadline))) });
  if (result.error?.code === 'ETIMEDOUT') throw new Processing(name + ' verification timed out');
  assert(result.status === 0, name + ' publication check failed');
  return result.stdout.trim();
}
export function verifyArtifact(directory, version) {
  const report = JSON.parse(fs.readFileSync(path.join(directory, 'npm-report.json')));
  assert.equal(report.name, NAME);
  assert.equal(report.version, version);
  assert.equal(report.format_version, 1);
  assert.equal(report.dependency_graph_sha256, GRAPH_SHA256);
  assert.equal(report.npm, NPM_VERSION);
  assert.equal(report.node, '24.17.0', 'Publication requires the fixed build runtime');
  assert.equal(path.basename(report.file), report.file);
  assert.deepEqual(fs.readdirSync(directory).sort(), [report.file, 'npm-report.json'].sort());
  const archive = fs.readFileSync(path.join(directory, report.file));
  assert.equal(sha256(archive), report.sha256, 'Artifact hash mismatch');
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), report.integrity);
  const files = tarFiles(archive);
  const expected = new Map(report.files.map(item => [item.path, item]));
  assert.deepEqual([...files.keys()].sort(), [...expected.keys()].sort());
  for (const [name, item] of files) {
    assert.equal(item.sha256, expected.get(name).sha256);
    assert.equal(item.mode, expected.get(name).mode);
    assert(!name.startsWith('.github/'), 'Release tooling in npm artifact');
  }
  const manifest = JSON.parse(files.get('package.json').data.toString());
  assert.equal(manifest.name, NAME);
  assert.equal(manifest.version, version);
  assert.equal(manifest.repository, REPOSITORY);
  assert(!manifest.private && !manifest.scripts);
  assert.deepEqual(manifest.dependencies, { 'mcp-remote': '0.15.2' });
  assert.deepEqual(manifest.bundleDependencies, ['mcp-remote']);
  return report;
}
export function verifyProvenance(document, { integrity, sha, ref }) {
  const digest = Buffer.from(integrity.split('-', 2)[1], 'base64').toString('hex');
  const statements = (document.attestations || []).filter(item =>
    item.predicateType === 'https://slsa.dev/provenance/v1').map(item =>
    JSON.parse(Buffer.from(item.bundle.dsseEnvelope.payload, 'base64').toString()));
  assert(statements.some(statement => {
    const definition = statement.predicate?.buildDefinition;
    const workflow = definition?.externalParameters?.workflow;
    return statement.subject?.some(subject => subject.digest?.sha512 === digest)
      && workflow?.repository === REPOSITORY && workflow?.ref === ref
      && workflow?.path === '.github/workflows/publish-npm.yml'
      && definition?.resolvedDependencies?.some(dependency =>
        dependency.digest?.gitCommit === sha && dependency.uri?.startsWith('git+' + REPOSITORY + '@'));
  }), 'Published provenance does not match source and artifact');
}
function stateLocation(filename, directory) {
  assert(filename && directory, 'Artifact directory and publication state are required');
  const resolved = path.resolve(filename);
  const inside = parent => resolved === parent || resolved.startsWith(parent + path.sep);
  assert(!inside(path.resolve(directory)) && !inside(process.cwd()), 'State must be outside source and artifact directories');
  for (let current = resolved;; current = path.dirname(current)) {
    try { assert(!fs.lstatSync(current).isSymbolicLink(), 'Publication state path contains a symbolic link'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.dirname(current) === current) break;
  }
  return resolved;
}
function stateBinding(selection, report, directory, environment) {
  assert.match(environment.GITHUB_RUN_ID || '', /^\d+$/, 'Expected the originating workflow run ID');
  return { format_version: 1, selection, run_id: environment.GITHUB_RUN_ID,
    input_sha256: report.input_sha256, artifact_sha256: report.sha256, integrity: report.integrity,
    report_sha256: sha256(fs.readFileSync(path.join(directory, 'npm-report.json'))) };
}
function loadState(filename, binding, environment) {
  assert(fs.existsSync(filename) && fs.lstatSync(filename).isFile(), 'Publication state is missing');
  const bytes = fs.readFileSync(filename);
  assert.match(environment.FOTOR_PUBLICATION_STATE_SHA256 || '', /^[a-f0-9]{64}$/, 'Missing trusted state digest');
  assert.equal(sha256(bytes), environment.FOTOR_PUBLICATION_STATE_SHA256, 'Publication state digest mismatch');
  const state = JSON.parse(bytes);
  assert.deepEqual(Object.keys(state).sort(), [...Object.keys(binding), 'latest_before', 'channel_before'].sort(), 'Unexpected state fields');
  for (const [key, value] of Object.entries(binding)) assert.deepEqual(state[key], value, 'Publication state binding mismatch: ' + key);
  for (const key of ['latest_before', 'channel_before']) {
    assert(state[key] === null || (typeof state[key] === 'string' && versionPattern.test(state[key])), 'Invalid channel baseline');
  }
  return state;
}
function checkLatest(metadata, selection, expected) {
  if (selection.channel !== 'next') return;
  assert(typeof expected === 'string' && versionPattern.test(expected), 'next requires an approved latest baseline');
  assert.equal(metadata?.['dist-tags']?.latest, expected, 'latest changed from its approved baseline');
}
function checkSource(selection, run) {
  assert.equal(run('git', ['rev-parse', 'HEAD']), selection.sha);
  run('git', ['diff', '--exit-code', 'HEAD', '--']);
  const branch = selection.channel === 'next' ? 'release/test' : 'main';
  const current = JSON.parse(run('gh', ['api', 'repos/' + repo + '/commits/' + branch]));
  assert.equal(current.sha, selection.sha, 'Branch changed since workflow dispatch');
}
async function observedPublication({ selection, report, state, rt, deadline }) {
  const metadata = await readRegistry(registry + encodeURIComponent(NAME), rt, deadline, { absentAllowed: true });
  if (!metadata) throw new Processing('package is not yet publicly visible');
  checkLatest(metadata, selection, state.latest_before);
  const tag = metadata['dist-tags']?.[selection.channel];
  assert(tag === undefined || tag === state.channel_before || tag === selection.version, 'Publication channel moved to an unexpected version');
  const published = metadata.versions?.[selection.version];
  if (!published) throw new Processing('target version is not yet publicly visible');
  if (published.name !== undefined) assert.equal(published.name, NAME, 'Published package name mismatch');
  if (published.version !== undefined) assert.equal(published.version, selection.version, 'Published version mismatch');
  if (!published.dist?.integrity) throw new Processing('published integrity is not yet available');
  assert.equal(published.dist.integrity, report.integrity, 'Published integrity mismatch');
  if (!published.dist.tarball) throw new Processing('published tarball is not yet available');
  const archive = await readRegistry(published.dist.tarball, rt, deadline, { bytes: true });
  assert.equal(sha256(archive), report.sha256, 'Published tarball SHA-256 mismatch');
  assert.equal('sha512-' + createHash('sha512').update(archive).digest('base64'), report.integrity, 'Published tarball integrity mismatch');
  const attestation = published.dist.attestations?.url;
  if (!attestation) throw new Processing('provenance is not yet available');
  const document = await readRegistry(attestation, rt, deadline);
  assert(Array.isArray(document.attestations), 'Invalid provenance response');
  if (!document.attestations.some(item => item.predicateType === 'https://slsa.dev/provenance/v1')) {
    throw new Processing('provenance statement is not yet available');
  }
  verifyProvenance(document, { integrity: report.integrity, sha: selection.sha, ref: selection.ref });
  if (tag !== selection.version) throw new Processing('publication channel has not caught up');
}
export async function gate({ phase, version, channel, directory, state: stateFilename,
  environment = process.env, dependencies = {} }) {
  assert(['preflight', 'published'].includes(phase));
  if (phase === 'published') assert(directory && stateFilename, 'Published verification requires artifact and state');
  const rt = runtime(dependencies), deadline = rt.now() + WAIT_MS;
  const run = (name, args) => command(name, args, rt, deadline);
  const selection = { version, channel, ref: environment.GITHUB_REF,
    repository: environment.GITHUB_REPOSITORY, sha: environment.GITHUB_SHA };
  validateSelection(selection);
  if (phase === 'preflight') {
    assert.equal(environment.GITHUB_RUN_ATTEMPT, '1', 'Do not rerun publication jobs; use read-only published verification');
  }
  checkSource(selection, run);
  let report;
  if (directory) {
    report = verifyArtifact(directory, version);
    const input = run('git', ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').map(name => {
      const stat = fs.lstatSync(name);
      assert(stat.isFile() && !stat.isSymbolicLink(), 'Unexpected source file');
      return { path: name, sha256: sha256(fs.readFileSync(name)), mode: stat.mode & 0o777 };
    }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
    assert.equal(report.input_sha256, sha256(canonical(input)), 'Artifact was built from different source files');
  }
  if (channel === 'latest') {
    const release = JSON.parse(run('gh', ['api', 'repos/' + repo + '/releases/tags/v' + version]));
    validateStableRelease({ version, sha: selection.sha, release,
      tagType: run('git', ['cat-file', '-t', 'refs/tags/v' + version]),
      tagCommit: run('git', ['rev-parse', 'refs/tags/v' + version + '^{commit}']) });
  }
  const manifest = JSON.parse(fs.readFileSync('package.json'));
  assert.equal(manifest.name, NAME); assert.equal(manifest.version, version);
  if (phase === 'preflight') {
    const metadata = await readRegistry(registry + encodeURIComponent(NAME), rt, deadline, { absentAllowed: true });
    assertVersionAvailable(metadata, version);
    checkLatest(metadata, selection, environment.EXPECTED_LATEST);
    if (!stateFilename) {
      assert(!directory, 'An artifact preflight requires publication state');
      return { status: 'preflight', source: selection.sha, version, channel, absent: true };
    }
    const filename = stateLocation(stateFilename, directory);
    const binding = stateBinding(selection, report, directory, environment);
    let state;
    if (fs.existsSync(filename)) {
      state = loadState(filename, binding, environment);
      assert.equal(metadata?.['dist-tags']?.latest ?? null, state.latest_before, 'latest changed after build approval baseline');
      assert.equal(metadata?.['dist-tags']?.[channel] ?? null, state.channel_before, 'Publication channel changed after build');
    } else {
      assert(!environment.FOTOR_PUBLICATION_STATE_SHA256, 'Expected state was removed');
      state = { ...binding, latest_before: metadata?.['dist-tags']?.latest ?? null,
        channel_before: metadata?.['dist-tags']?.[channel] ?? null };
      fs.writeFileSync(filename, JSON.stringify(state, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    }
    return { status: 'ready', source: selection.sha, version, channel, absent: true,
      state_sha256: sha256(fs.readFileSync(filename)), latest_before: state.latest_before };
  }
  const filename = stateLocation(stateFilename, directory);
  const binding = stateBinding(selection, report, directory, environment);
  const state = loadState(filename, binding, environment);
  if (channel === 'next') assert.equal(state.latest_before, environment.EXPECTED_LATEST, 'Approved latest and state differ');
  const exitText = environment.FOTOR_PUBLISH_EXIT_CODE;
  assert(exitText === undefined || /^\d{1,3}$/.test(exitText), 'Invalid publication exit status');
  const exitCode = exitText === undefined ? null : Number(exitText);
  const errorCode = environment.FOTOR_PUBLISH_ERROR_CODE || '';
  assert(/^(?:|E401|E403|EOTP|ENEEDAUTH)$/.test(errorCode), 'Invalid publication error classification');
  const authenticationFailure = Boolean(errorCode);
  let lastReason = 'registry verification not completed';
  for (;;) {
    try {
      checkSource(selection, run);
      await observedPublication({ selection, report, state, rt, deadline });
      checkSource(selection, run); remaining(rt, deadline);
      const result = { status: 'verified', source: selection.sha, version, channel,
        integrity: report.integrity, provenance: true, latest_before: state.latest_before,
        publish_exit_code: exitCode, retry_publish: false };
      rt.log(result);
      assert(!authenticationFailure && (exitCode === null || exitCode === 0),
        'Registry verified, but original publication command failed; preserve and investigate the original result');
      return result;
    } catch (error) {
      if (!(error instanceof Processing)) throw error;
      lastReason = error.message;
      if (authenticationFailure) throw new Error('Publication authentication failed (' + errorCode + '); registry remains unconfirmed');
      const left = deadline - rt.now();
      if (left <= 0) throw new PublicationPending(lastReason, exitCode);
      rt.log({ status: 'processing', reason: lastReason, remaining_ms: Math.ceil(left), publish_exit_code: exitCode, retry_publish: false });
      await rt.sleep(Math.min(left, Math.max(POLL_MS, error.retryAfter)));
      if (rt.now() >= deadline) throw new PublicationPending(lastReason, exitCode);
    }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [phase, version, channel, ...rest] = process.argv.slice(2);
  const directory = rest[0] !== '--state' ? rest.shift() : undefined;
  const state = rest.length === 2 && rest[0] === '--state' ? rest[1] : undefined;
  assert(rest.length === 0 || state, 'Expected optional artifact directory and --state PATH');
  gate({ phase, version, channel, directory, state }).then(result => console.log(JSON.stringify(result)))
    .catch(error => {
      console.error(JSON.stringify(error.result || { status: 'failed', reason: error.message, retry_publish: false }));
      process.exitCode = error instanceof PublicationPending ? 2 : 1;
    });
}
