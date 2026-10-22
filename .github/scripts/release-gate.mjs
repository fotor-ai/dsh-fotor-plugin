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
function command(name, args) {
  const result = spawnSync(name, args, { encoding: 'utf8', timeout: 30_000 });
  assert(result.status === 0, name + ' publication check failed');
  return result.stdout.trim();
}
async function readRegistry(url, absentAllowed = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status === 404 && absentAllowed) return undefined;
  assert(response.ok, 'Registry check failed: ' + response.status);
  return response.json();
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
  assert.deepEqual(manifest.dependencies, { 'mcp-remote': '0.15.1' });
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
export async function gate({ phase, version, channel, directory, environment = process.env }) {
  assert(['preflight', 'published'].includes(phase));
  const selection = { version, channel, ref: environment.GITHUB_REF,
    repository: environment.GITHUB_REPOSITORY, sha: environment.GITHUB_SHA };
  validateSelection(selection);
  assert.equal(command('git', ['rev-parse', 'HEAD']), selection.sha);
  command('git', ['diff', '--exit-code', 'HEAD', '--']);
  if (directory) {
    const report = verifyArtifact(directory, version);
    const input = command('git', ['ls-tree', '-r', '--name-only', 'HEAD']).split('\n').map(name => {
      const stat = fs.lstatSync(name);
      assert(stat.isFile() && !stat.isSymbolicLink(), 'Unexpected source file');
      return { path: name, sha256: sha256(fs.readFileSync(name)), mode: stat.mode & 0o777 };
    }).sort((a, b) => a.path.localeCompare(b.path, 'en'));
    assert.equal(report.input_sha256, sha256(canonical(input)), 'Artifact was built from different source files');
  }
  const branch = channel === 'next' ? 'release/test' : 'main';
  const current = JSON.parse(command('gh', ['api', 'repos/' + repo + '/commits/' + branch]));
  assert.equal(current.sha, selection.sha, 'Branch changed since workflow dispatch');
  if (channel === 'latest') {
    const release = JSON.parse(command('gh', ['api', 'repos/' + repo + '/releases/tags/v' + version]));
    validateStableRelease({ version, sha: selection.sha, release,
      tagType: command('git', ['cat-file', '-t', 'refs/tags/v' + version]),
      tagCommit: command('git', ['rev-parse', 'refs/tags/v' + version + '^{commit}']) });
  }
  const manifest = JSON.parse(fs.readFileSync('package.json'));
  assert.equal(manifest.name, NAME);
  assert.equal(manifest.version, version);
  const metadata = await readRegistry(registry + encodeURIComponent(NAME), true);
  if (phase === 'preflight') {
    assertVersionAvailable(metadata, version);
    return { source: selection.sha, version, channel, absent: true };
  }
  assert.equal(phase, 'published');
  const report = verifyArtifact(directory, version);
  const published = metadata?.versions?.[version];
  assert.equal(published?.dist?.integrity, report.integrity);
  assert.equal(metadata?.['dist-tags']?.[channel], version);
  const url = new URL(published?.dist?.attestations?.url);
  assert.equal(url.origin, registry.slice(0, -1));
  verifyProvenance(await readRegistry(url), { integrity: report.integrity, sha: selection.sha, ref: selection.ref });
  return { source: selection.sha, version, channel, integrity: report.integrity, provenance: true };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [phase, version, channel, directory] = process.argv.slice(2);
  gate({ phase, version, channel, directory }).then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
