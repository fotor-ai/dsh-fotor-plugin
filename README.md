# Fotor for DeepSeek Harness

> Requires stable Node 24.2.0 or later within 24.x, or stable Node 26.x. The fixed DeepSeek Harness 0.2.1-rc.2 launcher needs `import.meta.main`, introduced in Node 24.2.0. Earlier Node 24 releases are outside the supported range. Use the release's recorded runtime results for the exact tested versions.

<p align="center"><img src="assets/logo.svg" width="72" alt="Fotor logo" /></p>

<p align="center">
  <img src="https://img.shields.io/static/v1?label=version&amp;message=0.6.0&amp;color=087f8c&amp;style=flat-square" alt="Version" />
  <img src="https://img.shields.io/static/v1?label=channel&amp;message=production&amp;color=238636&amp;style=flat-square" alt="Release channel" />
  <a href="LICENSE"><img src="https://img.shields.io/static/v1?label=license&amp;message=Apache-2.0&amp;color=57606a&amp;style=flat-square" alt="Apache-2.0 license" /></a>
</p>
<p align="center">
  <a href="#dsh"><img src="https://img.shields.io/static/v1?label=agent&amp;message=DeepSeek+Harness&amp;color=24292f&amp;style=flat-square" alt="DeepSeek Harness" /></a>
</p>

Use Fotor's shared skills with DeepSeek Harness Web and an automatically installed MCP bridge dependency.

| Field | Value |
| --- | --- |
| Bundle | `@fotor-ai/dsh-fotor-plugin` |
| Version | `0.6.0` |
| Release channel | `production` |
| Service environment | `production` |
| MCP endpoint | `https://mcp.fotor.com/mcp` |
| Declared host range | `>=0.2.1-rc.2 <0.3.0-0` |
| Host baseline | Linux DeepSeek Harness Web 0.2.1-rc.2 |
| Bridge | mcp-remote 0.15.1 |
| Node range | `>=24.2.0 <25.0.0 \|\| 26.x`, stable versions |
| License | Apache-2.0 |

## Verification scope

Package checks cover files, references, and configuration. Verify installation, MCP authorization and calls, website login, credit links, uploads, and media execution separately in the selected host and environment. A release or model query does not establish successful website login or completed media results.

The Bundle only declares host-owned components and resources. The bridge is acquired by the package manager and owns OAuth. npm artifacts carry its full runtime dependency tree; Git installs download the dependency. Complete support requires real controlled reauthorization recovery as well as installation, calls, website access and restart reuse; consult the evidence for the installed release. Media execution and expiry-driven refresh are not established by static checks.

<a id="dsh"></a>

## DeepSeek Harness

DeepSeek Harness is abbreviated as `dsh` in commands and native identifiers.

<a id="dsh-installation"></a>

### DeepSeek Harness installation

#### Production release

First verify that the selected revision contains the DeepSeek Harness Bundle. Install this scoped package and its pinned bridge dependency to the chosen profile. Both components stay disabled until local setup.

```bash
dsh plugin --profile web add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git" --ignore-scripts
```

This is the standalone root Bundle for [https://github.com/fotor-ai/dsh-fotor-plugin](https://github.com/fotor-ai/dsh-fotor-plugin). Use its root Git source only after the selected channel contains this version. The [multi-platform repository](https://github.com/fotor-ai/fotor-agent-plugins) documents this external source; it no longer distributes new DeepSeek Harness packages. Existing subdirectory installations require a one-way native source migration.

The Bundle identity is `@fotor-ai/dsh-fotor-plugin`. After the corresponding npm channel is published, its alternative is `dsh plugin --profile web add "@fotor-ai/dsh-fotor-plugin" --ignore-scripts` (production) or `dsh plugin --profile web add "@fotor-ai/dsh-fotor-plugin@next" --ignore-scripts` (test). Verify the resolved version and select one source only. Bare-name npm installation follows `latest`; until the formal 0.6.0 rollout, that tag retains the accepted test.1 bootstrap exception and does not mean stable 0.6.0.

Installation automatically obtains **mcp-remote 0.15.1**. Git sources download it through the host package manager; npm artifacts carry its complete locked runtime tree. Fotor skills remain script-free. No installation hook starts the bridge or OAuth, and Node is not bundled.

Follow the [complete installation guide](INSTALL.md):

1. Check Linux DeepSeek Harness Web `0.2.1-rc.2` and stable Node **24.2.0 or later within 24.x, or 26.x**.
2. Install one source with lifecycle scripts disabled.
3. Query actual package and dependency paths; verify both bridge entrypoints.
4. Apply full external configuration and enable only skills first.
5. Configure the model account separately; complete bridge-client Fotor authorization and actual tool discovery, stop that client, then enable MCP. Website access is a separate request.

The declared host range is `>=0.2.1-rc.2 <0.3.0-0`; matching versions are not automatically verified. Desktop, headless and ACP require separate acceptance.

<a id="dsh-configuration-and-connection"></a>

### DeepSeek Harness configuration and connection

Installation adds two disabled components. Use native `root`, `list` and `why` queries as described in the guide; do not guess pnpm storage paths. A bundled npm dependency can be absent from the ordinary native list; follow the guide to verify the declared bundle under the actual installed package. Copy the [full configuration example](configuration.example.yml) outside the package and fill every absolute path. Overrides replace complete `config` objects. Keep default skill roots and native MCP reconnect disabled.

The native client directly runs the installed dependency using structured `command`, `args`, `env` and `cwd`. Keep `MCP_REMOTE_CONFIG_DIR` dedicated to Fotor and outside updates. Follow [authentication instructions](skills/fotor-connect/references/authentication.md), retaining independent-client discovery, user Continue / Wait / Cancel and client shutdown before the proxy starts. The bridge owns OAuth.

Use the user's confirmed daily ordinary browser. MCP-only requests do not request website links; website requests prepare the browser, open the original handoff once through native permission controls, and wait for actual page confirmation. An existing login is not a first-login result.

<a id="dsh-updates"></a>

### DeepSeek Harness updates

For a recorded Git source:

```bash
dsh plugin --profile web update @fotor-ai/dsh-fotor-plugin --ignore-scripts
dsh plugin --profile web why @fotor-ai/dsh-fotor-plugin
```

For a recorded npm source, replace `<target-version>` with the approved, published version:

```bash
dsh plugin --profile web update "@fotor-ai/dsh-fotor-plugin@<target-version>" --ignore-scripts
```

Immediate `@next` updates retained test.1 during test.2 acceptance; exact-version native updates passed. An unqualified update can also retain the saved version. Neither `@latest` update success nor eventual success after 24 hours is established. Use the [maintenance procedure](INSTALL.md#7-use-update-or-remove-fotor); keep release-age protection and request separate approval for any exact-version exception. Never apply an npm selector to a Git source as an ordinary update.

Verify the source, version, files and actual skill/bridge directories in a new process. Preserve profile/store, credentials and connection parameters. If installation used a custom `--store-dir`, pass that same argument to updates and removal. A zero exit code with the old version is not an upgrade; cache clearing or reinstall does not turn it into a pass.

<a id="dsh-source-selection-and-removal"></a>

### DeepSeek Harness source selection and removal

#### Production release

First verify that the selected revision contains the DeepSeek Harness Bundle. Install this scoped package and its pinned bridge dependency to the chosen profile. Both components stay disabled until local setup. Record the old source and scope, remove only this Fotor Bundle through native controls, then add the selected source. Preserve the external credential directory; resolve both bridge and installed skill paths before enabling the new package.

```bash
dsh plugin --profile web add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git" --ignore-scripts
```

#### Test release

First verify that the selected revision contains the DeepSeek Harness Bundle. Install this scoped package and its pinned bridge dependency to the chosen profile. Both components stay disabled until local setup. Record the old source and scope, remove only this Fotor Bundle through native controls, then add the selected source. Preserve the external credential directory; resolve both bridge and installed skill paths before enabling the new package.

```bash
dsh plugin --profile web add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git#release/test" --ignore-scripts
```

Legacy `fotor` and scoped packages are different identities. Stop Fotor components, record old source/profile/store/paths, remove only their override rows, then remove the old Bundle with `dsh plugin --profile web remove fotor --config.ignore-scripts=true`. Add one scoped source and resolve both installed skill and bridge paths again. Preserve model settings, the external credential directory, callback/security parameters and daily browser state; do not automatically remove the old external bridge.

GitHub/npm switching uses the same explicit remove/add sequence, with `@fotor-ai/dsh-fotor-plugin` as the removal target. Keep one installed source and one component pair. Ordinary update does not rename packages or switch sources. See [maintenance](INSTALL.md#7-use-update-or-remove-fotor).


## Workflows

Start with [connection and model discovery](skills/fotor-connect/references/mcp-integration.md#runtime-workflow), then select the skill matching the request. Follow [media preparation](skills/fotor-connect/references/media-upload.md) for local references and [credits](skills/fotor-connect/references/credits.md) for balance/pricing requests. These instructions do not establish host acceptance of every media operation.

## Bundle contents

- `package.json` and `cordis.patch.yml`: the declarative Bundle and two initially disabled components.
- `configuration.example.yml`: complete local setup example; never auto-applied.
- `INSTALL.md`: self-contained setup and migration guide.
- `package-lock.json`: reviewed npm release-build input in Git snapshots; not a host-level Git dependency lock.
- npm artifacts additionally contain the pinned third-party runtime; Fotor skills remain script-free.
- `.github/`: Git snapshot publication tooling, excluded from installed packages.
- `skills/`, including each skill's `references/`: shared workflows and DeepSeek Harness bridge/browser guidance.
- `assets/logo.svg`, `README.md` and `LICENSE`: package-local documentation and branding.

## License

[Apache-2.0](LICENSE)

## Skill-local references

Every packaged skill carries four generated documents in its own `references/` directory, including this platform's authentication guide. Read them as needed; complete runtime documentation does not install or configure MCP.
