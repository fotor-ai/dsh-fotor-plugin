/** Reserve one external Fotor store across host processes without reading credentials. */
import { constants } from 'node:fs';
import { mkdir, open, lstat, unlink } from 'node:fs/promises';
import path from 'node:path';

export async function acquireLease(directory) {
  await mkdir(path.dirname(directory), { recursive: true, mode: 0o700 });
  const filename = directory + '.connection-lock';
  let handle;
  try { handle = await open(filename, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Fotor connection lock exists; stop the other connection or inspect this adapter-owned lock before retrying');
    throw new Error('Fotor connection lock could not be created');
  }
  const identity = await handle.stat();
  try { await handle.writeFile(JSON.stringify({ pid: process.pid }) + '\n'); }
  finally { await handle.close(); }
  let released = false;
  return async () => {
    if (released) return;
    released = true;
    const current = await lstat(filename).catch(() => null);
    if (current?.isFile() && current.ino === identity.ino && current.dev === identity.dev) await unlink(filename);
  };
}
