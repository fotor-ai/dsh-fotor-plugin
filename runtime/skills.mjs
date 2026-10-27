/** Adapt the native filesystem provider to this installed package. */
import z from '@deepseek-ai/schemastery';
import { resolveSkills } from './config.mjs';
export const name = 'fotor-skills';
export const inject = ['skills'];
export const Config = z.object({
  providerName: z.string(), includeDefaultRoots: z.const(false),
  customSkillDirs: z.union([z.const(undefined), z.array(z.string())]), watch: z.boolean(),
  dshHome: z.string(), agentsHome: z.string(),
});
export async function apply(ctx, input = {}) {
  if (ctx.get('fotorSkills')) throw new Error('Fotor skill provider already registered');
  const config = await resolveSkills(input);
  ctx.provide('fotorSkills', { root: config.customSkillDirs[0] });
  const native = await import('@deepseek-ai/dsh-skill-filesystem');
  const child = ctx.plugin(native, config);
  ctx.effect(() => () => child.dispose(), 'fotor skill provider');
  await child.await();
}
