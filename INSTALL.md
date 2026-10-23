# Install and use Fotor with DeepSeek Harness

> Requires stable Node 24.2.0 or later within 24.x, or stable Node 26.x. The fixed DeepSeek Harness 0.2.1-rc.2 launcher needs `import.meta.main`, introduced in Node 24.2.0. Earlier Node 24 releases are outside the supported range. Use the release's recorded runtime results for the exact tested versions.

DeepSeek Harness is abbreviated as `dsh` in commands and native identifiers. This guide is self-contained for the independent 0.6.0 package. Test distributions are available; stable availability is separate. This internal refresh pins mcp-remote 0.15.2; published test.3 retains 0.15.1 until a refreshed channel is released. Check the selected GitHub revision or npm version before installing. Existing 0.5.1 installations retain their original guide until migrated to the scoped identity.

During the 0.6.0 test rollout, GitHub's default branch still supplies 0.5.1 and npm `latest` retains the accepted first-publication exception, `0.6.0-test.1`. Bare-name npm installation therefore selects a prerelease until the formal rollout replaces it. Use the GitHub test branch or a verified npm test version during that interval; use production examples only after the selected channel contains the intended stable release.

## 1. Check prerequisites and select a profile

Use Linux DeepSeek Harness Web `0.2.1-rc.2` (source `687f282e8625c6b8d11ff58211a90524be2e4317`), its available native package manager, and a stable Node **24.2.0 or later within 24.x, or 26.x**. Node 24.0.x, 24.1.x, 25.x, 27.x and prereleases are outside the declared range. The host range remains `>=0.2.1-rc.2 <0.3.0-0`; admission is not evidence that every host/runtime combination has been tested. Consult the installed release's acceptance record. Desktop, headless and ACP require separate acceptance.

```bash
dsh --version
node --version
dsh plugin --profile web root
```

Git sources additionally require Git. Follow the [host quickstart](https://deepseek-harness.github.io/deepseek-harness/en/guide/quickstart) or [Node downloads](https://nodejs.org/en/download/) for missing prerequisites. Node is not bundled. Preserve daily installations; do not upgrade them to satisfy an acceptance run.

Select one profile, working directory and Fotor-only credential directory outside the installed package. Inspect existing Fotor components before changing anything. A model-provider account is separate from Fotor OAuth. If installation uses a custom `--store-dir /absolute/path/to/store`, record it and pass that same argument on later add, update and remove commands. Retain the original profile and source as well.

**Done when:** the host and Node versions are known, the native package manager works, and the profile and external storage locations are selected.

## 2. Install one Bundle source

The package name is **`@fotor-ai/dsh-fotor-plugin`** for both sources. Installing it automatically obtains the pinned **mcp-remote 0.15.2** runtime. There is no separate bridge installation command. Git installation downloads the dependency through the host package manager; npm artifacts already carry the bridge and its complete runtime dependency tree. Installation starts neither the bridge nor OAuth.

Choose exactly one command after its channel is published:

```bash
# GitHub production: default branch.
dsh plugin --profile web add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git" --ignore-scripts
# GitHub test channel.
dsh plugin --profile web add "git+https://github.com/fotor-ai/dsh-fotor-plugin.git#release/test" --ignore-scripts
# npm production: only after latest is the intended stable release.
dsh plugin --profile web add "@fotor-ai/dsh-fotor-plugin" --ignore-scripts
# npm test channel.
dsh plugin --profile web add "@fotor-ai/dsh-fotor-plugin@next" --ignore-scripts
```

For an internal or local rehearsal, replace the source with the absolute path to the complete independent package. The multi-platform repository root is Pi's facade and is not a DeepSeek Harness package. Never install both sources, aliases, or the legacy `fotor` alongside the scoped package.

**Done when:** native installation succeeds and reports the scoped identity and expected version. Preserve a failed dependency download as a failed installation; do not continue with a missing bridge or use an unpinned `npx` workaround.

## 3. Resolve the installed package and bridge

Use the original profile and package-manager store. Set variables from native output and verified absolute paths:

```bash
FOTOR_PROFILE=web
dsh plugin --profile "$FOTOR_PROFILE" why @fotor-ai/dsh-fotor-plugin
dsh plugin --profile "$FOTOR_PROFILE" root
FOTOR_INSTALLED="$(realpath "$(dsh plugin --profile "$FOTOR_PROFILE" root)/@fotor-ai/dsh-fotor-plugin")"
dsh plugin --profile "$FOTOR_PROFILE" list mcp-remote --depth Infinity --parseable
dsh plugin --profile "$FOTOR_PROFILE" why mcp-remote --json
```

Choose the resolution route matching the installed manifest:

- **Git source:** the dependency query can return multiple paths. Select the mcp-remote 0.15.2 dependency owned by this exact Fotor installation; stop on ambiguity. pnpm can place it beside the package rather than inside it. Set `FOTOR_BRIDGE` to that verified absolute dependency path.
- **npm artifact:** after verifying `bundleDependencies` names mcp-remote, resolve the bundled directory below. The native dependency list may omit bundled packages; an empty list alone is not a missing bridge.

```bash
# npm artifact only, after inspecting its manifest.
FOTOR_BRIDGE="$(realpath "$FOTOR_INSTALLED/node_modules/mcp-remote")"
```

For either source, verify the selected location before configuring it:

```bash
FOTOR_NODE=/absolute/path/to/node
cat "$FOTOR_INSTALLED/package.json"
cat "$FOTOR_BRIDGE/package.json"
test -f "$FOTOR_BRIDGE/dist/client.js"
test -f "$FOTOR_BRIDGE/dist/proxy.js"
```

Git pins the direct bridge version; its transitive graph is resolved by the host and should be recorded when reproducing a result. The packaged lock file is the npm release-build input, not a promise that pnpm honors it during Git installation.

**Done when:** the scoped package/version, bridge 0.15.2, both bridge entrypoints and all selected absolute paths are verified. A `why` result alone does not establish file completeness or the Git commit.

## 4. Prepare complete configuration

Copy [configuration.example.yml](configuration.example.yml) outside the installation and fill every placeholder:

| Parameter | Source and lifetime |
| --- | --- |
| Profile | The native profile selected for installation; keep it for updates/removal |
| Skill directory | Actual `FOTOR_INSTALLED` plus `/skills`; re-resolve after updates |
| Node command | Absolute executable for the selected supported Node version |
| Proxy/client entry | Actual `FOTOR_BRIDGE` plus `/dist/proxy.js` or `/dist/client.js`; re-resolve after updates |
| Home and agents home | Actual host locations; dedicated directories during acceptance |
| Working directory | Selected existing absolute workspace |
| `MCP_REMOTE_CONFIG_DIR` | Fotor-only external directory, separate from model credentials; retain across updates and source changes |
| Callback | One available port; example `3335`, host copied unchanged from `configuration.example.yml`; identical for client and proxy |
| Endpoint/resource | Both `https://mcp.fotor.com/mcp`; retain production and OAuth security parameters |

Overrides replace whole `config` objects, not individual nested fields. Retain both complete rows and all arguments. Keep native reconnect disabled. Do not copy credentials into the package, command arguments or documentation.

**Done when:** the full override is external, all paths are real and no conflicting `fotor` service or duplicate provider exists.

## 5. Apply complete configuration and load skills

Use the selected profile's native patch mechanism or an explicit external patch:

```bash
dsh --profile "$FOTOR_PROFILE" --patch /absolute/path/to/fotor.local.yml
```

The installed Bundle declares both components disabled. The example enables only skills; its MCP row stays disabled. Keep `includeDefaultRoots: false` and scan only the actual installed Fotor skill directory.

In the native menu, select `/fotor-connect`; ask it to read its instructions without authorizing or calling MCP. Confirm the resource path and one discovered copy of each actual Fotor skill. Each skill has four local reference documents.

Use the host's native `read` tool for those files. The Linux Shell sandbox can hide a `/tmp` installation while native reading still works; a failed Shell `ls` is not proof of a broken package. If native reading fails, stop and report the actual path/error rather than searching other installations.

**Done when:** the native provider discovers the package's actual skills and their local references, and MCP is still disabled.

## 6. Authorize then enable the connection

Read [this package's authentication guide](skills/fotor-connect/references/authentication.md) before connecting. Confirm the opener targets the user's daily ordinary browser, preserve its login state, and keep the proxy stopped while the independent authorization client runs.

```bash
MCP_REMOTE_CONFIG_DIR=/absolute/path/to/dsh-home/mcp-auth/fotor "$FOTOR_NODE" "$FOTOR_BRIDGE/dist/client.js" https://mcp.fotor.com/mcp 3335 --host "$FOTOR_CALLBACK_HOST" --transport http-only --resource https://mcp.fotor.com/mcp --auth-timeout 600 --connect-timeout 20 --headers-timeout 20 --body-timeout 20
```

Set `FOTOR_CALLBACK_HOST` to the callback host verified in the configuration example. Run in an interactive terminal that keeps stdin open. After the user selects Continue, require successful connection and actual tool discovery. A callback page or exit code alone is insufficient. Stop the client and callback listener before enabling the MCP row and restarting the profile. Keep the same endpoint, resource, callback and credential directory. Cancel/timeout stops the flow; human waiting is limited to ten minutes.

The bridge owns OAuth; this is not native remote OAuth in DeepSeek Harness. Model login, package installation, skills, Fotor authorization and website login are separate steps.

**Done when:** authorization-client discovery completes, that client/listener exits, and the enabled native stdio connection discovers actual Fotor tools.

## 7. Use, update or remove Fotor

Example requests:

- MCP-only: “Connect only to Fotor MCP and list image models. Do not open the website.”
- Website: “Connect to Fotor and introduce its capabilities.” Prepare the daily browser before requesting the one-use handoff; report website success only after user confirmation.
- Explicit skill: select `/fotor-image` and describe a task. Every successful `submit_*_task` may consume credits; preserve the existing authorization and retry rules.

Stop Fotor components and record their source, profile, store and external configuration before updating. Choose one command for the recorded source. For npm, replace `<target-version>` with an explicitly published and approved version, such as the exact version in the selected release notes:

```bash
# Recorded Git source only.
dsh plugin --profile "$FOTOR_PROFILE" update @fotor-ai/dsh-fotor-plugin --ignore-scripts
# Recorded npm source: select an exact published target, not a moving tag.
dsh plugin --profile "$FOTOR_PROFILE" update "@fotor-ai/dsh-fotor-plugin@<target-version>" --ignore-scripts
dsh plugin --profile "$FOTOR_PROFILE" why @fotor-ai/dsh-fotor-plugin
```

For a custom store, append the original `--store-dir` argument to the selected update command. An unqualified update can remain on the saved npm version. In the recorded test.1-to-test.2 acceptance, immediate `update ...@next` returned success but retained test.1 on both Node 24.2.0 and 26.0.0, even after an approved exception for that exact version's release age. Exact-version native updates passed. The guide therefore uses exact versions for npm updates; this does not establish that `@latest` updates work or that waiting 24 hours always resolves tag updates. Keep Git installations on their recorded Git source: applying an npm version selector is a source change, not a Git update.

Keep the package manager's release-age policy. If it blocks a newly published version, report the target and wait, or obtain separate approval for an exception limited to that exact version and isolated profile. The earlier test.2 approval does not cover later versions. Do not disable the policy globally, clear metadata caches or reinstall to manufacture an update pass.

**Done when:** the installed version and source match the selected target, files and managed bridge are complete, and a new process discovers one copy of each skill at the re-resolved paths. A zero exit code alone is insufficient. Update complete configuration rows if paths moved; preserve the external credential store, model settings and security parameters. Record a failed native update separately from any later reinstall.

### Migrate from the legacy package or switch sources

Legacy 0.5.1 and older packages are named `fotor`. A normal update does not rename them. Record source/profile/store/path and the external configuration, stop both components, and remove only their override rows. Remove the old identity, then install one scoped source from step 2:

```bash
dsh plugin --profile "$FOTOR_PROFILE" remove fotor --config.ignore-scripts=true
```

For GitHub/npm switching or scoped-package removal, use:

```bash
dsh plugin --profile "$FOTOR_PROFILE" remove @fotor-ai/dsh-fotor-plugin --config.ignore-scripts=true
```

This host baseline rejects `--ignore-scripts` on removal; use the configuration form above and append the original `--store-dir` argument when a custom store was used. After adding the new source, resolve package and managed bridge paths again and restore a complete override. Keep one scoped installation and one component pair. Keep the credential directory, model settings and all connection/security parameters unchanged. Do not automatically delete the old external bridge directory or claim real credential reuse from an offline migration rehearsal.

### Troubleshooting

- Missing bridge: inspect native install/download results and this package's dependency tree; finish installation before connecting.
- Changed installation path: re-query the native root/dependency paths and replace complete override rows.
- pnpm store mismatch: use the original profile/store; do not edit caches or move package-manager links manually.
- Duplicate skills/components: inspect selected sources and override rows before enabling either component.
- Authorization failure: follow the authentication guide's single-client bounded recovery sequence. Installation or restart success does not prove recovery from rejected credentials.

Uninstalling the Bundle does not revoke server-side consent. Delete only explicitly authorized temporary state after its processes stop; retain daily client configuration, credentials and browser login.
