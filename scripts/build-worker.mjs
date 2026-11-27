import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';

const directory = process.argv[2] ?? 'dist';
const worker = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const files = (await readdir(directory, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name !== 'version.json' && !/^sw-[a-f0-9]{64}\.js$/.test(entry.name))
  .map((entry) => relative(directory, join(entry.parentPath, entry.name)).split(sep).join('/'))
  .sort();

const assets = [];
for (const file of files) {
  const digest = createHash('sha256').update(await readFile(join(directory, file))).digest('hex');
  assets.push({ path: '/' + file, digest });
}

const version = createHash('sha256').update(worker).update(JSON.stringify(assets)).digest('hex');
await writeFile(join(directory, `sw-${version}.js`), `const BUILD = ${JSON.stringify({ version, assets })};\n${worker}`);
await writeFile(join(directory, 'version.json'), JSON.stringify({ version }) + '\n');
