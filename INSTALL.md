# Install and use Fotor with DeepSeek Harness

DeepSeek Harness is abbreviated as `dsh` in commands and native identifiers. This guide describes automatic configuration in Fotor 0.6.1. Version 0.6.0 uses its documented manual configuration. Read the package README's version and channel, and choose a source that actually contains the target version. A candidate snapshot does not publish the npm package or change either default branch.

## 1. Check prerequisites

The current acceptance baseline is Linux DeepSeek Harness Web `0.2.1-rc.3` and stable Node `>=24.2.0 <25.0.0 || 26.x`. Earlier rc.2 results retain their original scope; the declared host range remains `>=0.2.1-rc.2 <0.3.0-0`. Node is not bundled. Check `dsh --version` and `node --version`; do not upgrade a daily installation implicitly. See the official [DeepSeek Harness repository](https://github.com/deepseek-ai/deepseek-harness) and [Node downloads](https://nodejs.org/en/download). Desktop, headless and ACP require separate acceptance.

## 2. Choose one source

GitHub downloads the pinned **mcp-remote 0.15.2** dependency through the host package manager. npm artifacts carry its complete reviewed runtime tree. Neither path needs a separate bridge installation. Skills remain script-free; the package has no installation lifecycle hook.

Choose one source and a profile. Test channels must actually contain the requested version before use:

```bash
FOTOR_PROFILE=web
# GitHub default branch, after the target version is published:
dsh plugin --profile "$FOTOR_PROFILE" add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git" --ignore-scripts
# GitHub test branch:
dsh plugin --profile "$FOTOR_PROFILE" add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git#release/test" --ignore-scripts
# npm default or test channel:
dsh plugin --profile "$FOTOR_PROFILE" add "@fotor-ai/dsh-fotor-plugin" --ignore-scripts
dsh plugin --profile "$FOTOR_PROFILE" add "@fotor-ai/dsh-fotor-plugin@next" --ignore-scripts
# A complete local package for development:
dsh plugin --profile "$FOTOR_PROFILE" add /absolute/path/to/fotor-package --ignore-scripts
```

Run only the command for the chosen source. The Web **Plugins → Add plugin** entry accepts the same npm or GitHub source. After installation, click the host's **Enable now** button (or the Bundle switch). This selects the Bundle; its two components then activate automatically. The package cannot enable a Bundle the host has not loaded. Package name is `@fotor-ai/dsh-fotor-plugin` for both. Keep the original custom `--store-dir` argument for every later update/removal.

## 3. Verify installation

```bash
dsh plugin --profile "$FOTOR_PROFILE" root
dsh plugin --profile "$FOTOR_PROFILE" list --depth Infinity --json
dsh plugin --profile "$FOTOR_PROFILE" why @fotor-ai/dsh-fotor-plugin
```

Use the returned package root and actual dependency resolution for diagnosis, not a guessed pnpm store directory. Bundled npm dependencies can be absent from the ordinary dependency list; the installed package carries `node_modules/mcp-remote/package.json` and its `dist/client.js` and `dist/proxy.js`. Git installations use package-manager-owned links. Verify the bridge is 0.15.2.

Installation success is the expected version/source and complete files. It does not prove MCP connection. Never read the bridge's token files to diagnose installation.

## 4. Load the Bundle and resolve configuration

New installations require **no manual path configuration**. Start the chosen profile or allow the running Web host to load the Bundle:

```bash
dsh --profile "$FOTOR_PROFILE"
```

The package declares both adapters enabled. A saved explicit disabled override still wins. Skills are resolved relative to the installed Fotor package; Node comes from the running Web host; the bridge is resolved from the package's dependencies. Only this package's skill root is scanned.

The adapter creates complete native `command`, `args`, `env` and `cwd` values in memory. Credentials default to `<active-profile-directory>/fotor/mcp-auth`, outside the installation. The default callback is loopback port 3335. A conflicting listener produces a diagnosis; stop the conflicting task or configure an unused port without changing an existing authorization's parameters casually.

Optional MCP settings include `endpoint` (production Fotor by default; a loopback service is for isolated acceptance), `callbackPort`, and existing native stdio fields. A supplied `args` array is complete, not an append. Explicit `env.MCP_REMOTE_CONFIG_DIR` is preserved. The [full legacy configuration example](configuration.example.yml) remains available for advanced overrides; it is never auto-applied. Overrides replace the complete `config` object, not a deep merge.

## 5. Verify skills and existing overrides

For ordinary use, verify the native skill menu/provider discovers the actual Fotor skills and their own `references` directories. A green component indicator without discovered entries is insufficient. Read known references through native `read`; the Shell sandbox may hide an otherwise readable host path.

Old complete configuration is accepted. If an old skill or bridge path no longer exists, preserve the record and remove only the obsolete override using native profile configuration to adopt automatic resolution, or supply the corrected path. Do not edit package caches, reset unrelated settings or clear credentials. Resolve duplicate Fotor providers/services before enabling another copy.

<a id="6-authorize-then-enable-the-connection"></a>

## 6. Authorize and verify the connection

In 0.6.1 this sequence is managed automatically after host activation. The independent bridge client reuses authorization or opens the daily browser. Complete login/consent there. It must connect and discover tools, then exit with its callback listener closed before the proxy starts. Model account login remains a separate user action.

Connection diagnostics are `preparing`, `waiting-authorization`, `connected`, `failed` or `stopped`. The adapter being active is not a connected MCP. Authorization waits at most ten minutes and can be cancelled by disabling the MCP component. Failure does not loop through browser prompts; deliberately disable/enable to retry. Use the [authentication guide](skills/fotor-connect/references/authentication.md) for bounded recovery and browser handling.

Once connected, ask for a read-only model query. Website access is a separate request; preserve browser login and open each original handoff once. Never infer website login from MCP success.

## 7. Use, update, or remove Fotor

Examples: “Use Fotor's existing connection to list image models”; “Connect to the Fotor website”; or explicitly choose `/fotor-connect`. Media requests follow their own skill and credit notice rules.

For the recorded Git source:

```bash
dsh plugin --profile "$FOTOR_PROFILE" update @fotor-ai/dsh-fotor-plugin --ignore-scripts
```

For npm, select an explicitly published target:

```bash
dsh plugin --profile "$FOTOR_PROFILE" update "@fotor-ai/dsh-fotor-plugin@<target-version>" --ignore-scripts
```

During historical 0.6.0-test.2 acceptance, immediate `@next` updates retained 0.6.0-test.1; exact-version updates passed. Neither `@latest` success nor success after 24 hours is established. Keep release-age protection; an acceptance-only exception needs separate approval for the exact target version. Do not treat reinstall or cache clearing as a successful upgrade. Verify installed version/files and restart the host so its module generation and paths are refreshed. Preserve the profile and custom store.

Before upgrading 0.6.0, record the native source, profile, store, enabled state and explicit configuration without reading token files. With no overrides, 0.6.1 resolves paths when the host loads the Bundle. Existing complete configuration and explicit disabled settings remain authoritative: upgrading does not reopen a component the user disabled. Preserve valid custom paths and connection parameters; use native configuration only to correct or remove an obsolete path override. An npm version selector is not a Git-source update; source changes use the deliberate remove/add procedure below.

For removal:

```bash
dsh plugin --profile "$FOTOR_PROFILE" remove @fotor-ai/dsh-fotor-plugin --config.ignore-scripts=true
```

Stop the components first. Removal stops their processes but leaves credentials and explicit user configuration. Source switching uses deliberate removal/addition in the same profile/store; keep one source and one component pair. For the older unscoped `fotor` identity, remove that exact name before adding the scoped package. Keep old external bridge directories unless separately authorized to remove them.

Uninstall does not revoke server-side consent. Reinstalling in the same profile and credential directory can reuse accepted authorization; enabling still establishes a new connection. Verify that connection with an actual read-only query. A different `DSH_HOME`, profile, explicit `MCP_REMOTE_CONFIG_DIR` or connection parameters can select a different cache, and expired or rejected authorization can require new consent. Automatic configuration never migrates or copies tokens. Isolated acceptance cleanup may remove only that task's temporary state after all owned processes stop.
