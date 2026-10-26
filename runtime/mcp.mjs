/** Auto-configure the host MCP client and own its cancellable authorization stage. */
import z from '@deepseek-ai/schemastery';
import { resolveMcp } from './config.mjs';
import { startConnection } from './lifecycle.mjs';
export const name = 'fotor-mcp';
export const inject = ['profileContext', 'tools'];
export const Config = z.object({
  transport: z.const('stdio'), serverName: z.string(), command: z.string(),
  args: z.union([z.const(undefined), z.array(z.string())]), env: z.dict(String), cwd: z.string(),
  toolCallTimeoutMs: z.number().min(1), failOnStartupError: z.boolean(),
  maxInstructionBytes: z.natural().min(1), endpoint: z.string(),
  callbackPort: z.natural().min(1).max(65535),
  reconnect: z.union([z.const(undefined), z.object({ enabled: z.const(false), initialDelayMs: z.number(), maxDelayMs: z.number(), maxAttempts: z.number() })]),
});
export async function apply(ctx, input = {}) {
  const connection = await resolveMcp(input, { profileDir: ctx.profileContext.dir, cwd: ctx.profileContext.cwd });
  const prefix = 'mcp__' + connection.native.serverName + '__';
  if (ctx.get('fotorConnection') || ctx.tools.schemas().some(tool => tool.name.startsWith(prefix))) throw new Error('Fotor MCP service already registered');
  const native = await import('@deepseek-ai/dsh-mcp-client');
  const owner = startConnection(connection, {
    mount: config => {
      const prefix = 'mcp__' + config.serverName + '__';
      if (ctx.tools.schemas().some(tool => tool.name.startsWith(prefix))) throw new Error('Fotor MCP service already registered');
      const child = ctx.plugin(native, config);
      return { dispose: () => child.dispose(), await: async () => {
        await child.await();
        if (!ctx.tools.schemas().some(tool => tool.name.startsWith(prefix))) throw new Error('Fotor MCP did not discover tools');
      } };
    },
    status: (state, diagnostic) => ctx.logger.info('Fotor MCP: %s%s', state, diagnostic ? ' — ' + diagnostic : ''),
  });
  ctx.effect(() => () => owner.dispose(), 'fotor connection and callback cleanup');
  ctx.provide('fotorConnection', owner);
}
