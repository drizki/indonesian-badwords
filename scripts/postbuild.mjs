import { writeFile } from 'node:fs/promises';

const marker = new URL('../dist/cjs/package.json', import.meta.url);
await writeFile(marker, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
