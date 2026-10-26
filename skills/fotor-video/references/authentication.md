---
platform: dsh
---

# DeepSeek Harness authentication and browser access

DeepSeek Harness is abbreviated as `dsh` in commands and native identifiers.

## Ownership and baseline

The current acceptance baseline is Linux DeepSeek Harness Web `0.2.1-rc.3`, with package-manager-owned `mcp-remote 0.15.2` and stable Node `>=24.2.0 <25.0.0 || 26.x`. Historical rc.2 results retain their original scope; matching the declared host range alone is not acceptance. DeepSeek Harness owns the stdio client and tool permissions; the bridge owns OAuth and its credential store. Do not describe this as native remote OAuth in DeepSeek Harness. Desktop, headless and ACP have separate acceptance scopes.

Use this guide with the [shared runtime workflow](mcp-integration.md#runtime-workflow). Installation, authorization, actual calls, website access, restart reuse and reauthorization recovery are distinct outcomes. Do not infer full support from one successful call.

## Installation and automatic configuration

For installation, source changes, missing dependencies, or invalid saved paths, read the installed package README and `INSTALL.md`. GitHub installation obtains the pinned bridge through the package manager; npm carries its full dependency tree. Node remains external.

From 0.6.1, select the installed Bundle with Web **Enable now** or load its CLI profile. Host activation enables both adapters by default. `fotor-skills` resolves this package's skills and uses the native filesystem provider without default-root scanning. `fotor-mcp` resolves Node and both installed bridge entrypoints, then supplies complete native stdio configuration. Runtime defaults are not written into a user patch. A package download alone runs no hook or authorization.

Explicit profile/home/launch overrides, including disabled states and the external `MCP_REMOTE_CONFIG_DIR`, take precedence. Do not replace them or clear credentials to repair a path error. An obsolete path requires a targeted native configuration edit: remove only that override to adopt automatic resolution, or correct it. Conflicting Fotor services or skill providers require resolving the duplicate while preserving the existing installation.

Use native `root`, `list` and `why` for diagnostics; do not guess pnpm store paths. The skill provider's running state alone is not discovery: verify the actual Fotor entries and their installed resource paths. Use native `read` for skill references; the Linux Shell sandbox can hide host paths. Do not scan unrelated packages after a native read failure.

## First authorization

Enabling MCP starts one cancellable connection task. The adapter runs the installed mcp-remote client with the same credential directory, endpoint, resource, callback and security arguments as the proxy. The bridge reuses valid credentials or opens the ordinary browser for user login and consent. Fotor code does not read tokens, implement OAuth, or install dependencies during connection. Model-provider login is separate.

Confirm the opener uses the user's daily ordinary browser; retain its profile and login state. A task-specific routing override may be used without changing the system default; record it separately from untouched default-browser behavior. Human authorization still belongs to the user, including Continue / Wait / Cancel. The adapter's states and sanitized diagnostics distinguish `preparing`, `waiting-authorization`, `connected`, `failed` and `stopped`; an active adapter is not proof of a connected MCP service.

After Continue, require successful client connection and actual tools discovery. The client and callback listener must exit before the native MCP client starts the proxy. Proxy tool discovery completes readiness; a consent success page or zero client exit alone is insufficient. Authorization waits at most ten minutes. Cancel by disabling `fotor-mcp` through the native plugin controls; the owned child and callback must stop without blocking the Web interface. A cancelled or failed task waits for a deliberate disable/enable before another authorization attempt.

After connection, use `/fotor-connect` or the native skill tool for the actual discovered entry. Verify with a read-only `list_models` call when requested. MCP-only requests neither request a website link nor query credits. Installation, authorization, discovery and actual queries are distinct evidence.

## Website access

Prepare the user's daily ordinary browser before requesting a short-lived link. Preserve its existing Fotor login state; do not sign out, replace its profile or clear data to manufacture a fresh-login test. Confirm the intended browser/profile can be targeted before calling `get_website_url`.

Follow [one-time browser link rules](mcp-integration.md#one-time-browser-links): validate the production handoff endpoint and returned expiry, then open the exact original link once. A missing `target_url` must be reported truthfully, not invented. Do not prefetch, preview, rewrite or repeat a consumed link.

Use an available host opener and the exact confirmed daily browser profile. If the DeepSeek Harness shell sandbox prevents desktop access, request native approval for that single command with a clear purpose; do not change the session's standing permissions. A background browser job may need a result check for that same job, which must not launch the link again. Do not add browser diagnostics or a temporary web proxy.

If automatic opening is unavailable, provide the unconsumed original link in the native conversation for the user to open once in that browser. Record this as manual opening. Wait for confirmation of the final production website and login state. A successful command or a pre-existing signed-in page does not prove a signed-out-to-signed-in transition. Report MCP and website results separately, then introduce the main capabilities.

## Bounded recovery and controlled reauthorization

Use the shared two-retry limit, waits of two/five seconds and ninety-second automatic-stage budget. Human login time is excluded. Include the bridge's own actions in the record; do not add a second retry or OAuth loop. Disabling DeepSeek Harness reconnect does not guarantee the bridge will never open a new authorization page internally.

On an authorization failure, cancellation, permission denial or unknown state, stop the current call. Do not treat a login-page CORS/preflight rejection as the same failure as missing OAuth discovery state. A missing-discovery-state message does not prove that the issuer actually changed.

For user-requested reauthorization, use this single sequence:

1. Stop the failed operation, this profile's proxy and any leftover callback listener. Do not start a competing authorization flow.
2. Preserve the same credential directory and connection/security arguments. Do not read, copy or edit tokens.
3. Re-enable the MCP adapter after the user requests another connection attempt. It runs the standalone authorization client and applies the same Continue / Wait / Cancel handling and native-result verification.
4. Stop the standalone client, restart the configured DeepSeek Harness MCP and prove recovery with an actual read-only query. A successful consent page without that query is not recovery.

A cached client connection without a new consent flow is reuse, not invalid-grant recovery. Never clear a global authorization directory, substitute a new empty store, weaken issuer/resource/PKCE/TLS checks or sign out the daily website to force a test. Server-side invalid-grant acceptance requires a real failure or an available native operation limited to this exact temporary grant. If no safe trigger exists, report that recovery scope as unverified. Expiry-driven refresh likewise requires actual evidence.

An explicitly user-approved isolated local-cache-loss test is a separate acceptance scope. After stopping all task-owned processes and callbacks, verify ownership and ordinary-file type before removing only that connection's token cache, without reading its contents. Keep the original directory, registration and connection parameters. Re-enable the adapter for user consent, then require an actual query and another query after a full restart. Label this local credential-loss recovery; it does not establish server-side revocation, expiry or intact rejected-cache recovery.

## Updating and removing

Use the native Bundle commands in the package README. After updating, inspect the resolved source, version, file contents and actual skill directory; package-manager links outside the package are distinct from forbidden symlinks inside its resources. Keep only one enabled Fotor skill source. Re-resolve the managed bridge path when replacing a package; preserve the external credential store.

Disable this Bundle before native removal. Retain its external overrides and credentials unless the user explicitly requests a targeted removal. Cleanup of an isolated acceptance environment may delete that environment's local store after all related processes stop; that does not revoke server-side consent. Leave daily installations, credentials and browser login unchanged. Keep package, model-session, bridge, website, reuse and recovery evidence separate.

Reinstalling the same source/profile with the same credential directory can reuse accepted authorization. It still establishes a new connection, so verify actual discovery and a requested read-only query. Changing profile, home, credential directory or connection parameters can select another cache. Preserve explicit disabled settings and valid complete configuration when upgrading; correct only obsolete path overrides through native configuration.
