import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const marker = new URL('../dist/cjs/package.json', import.meta.url);
await writeFile(marker, `${JSON.stringify({ type: 'commonjs' }, null, 2)}\n`);
const require = createRequire(import.meta.url);
const { dictionary } = require('../dist/cjs/dictionary.js');
const { prepareNativePatterns } = require('../dist/cjs/pattern.js');

// Publish one compact runtime. tsc's individual modules remain available in the
// workspace for internal tests, but are not duplicated in the npm package.
await build({
    entryPoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
    outfile: fileURLToPath(new URL('../dist/cjs/index.js', import.meta.url)),
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2022',
    minify: true,
    define: { __BADWORDS_PRESET_PATTERNS__: JSON.stringify(prepareNativePatterns(dictionary)) },
    footer: { js: "Object.defineProperty(module.exports.Badwords, 'name', { value: 'Badwords' });" },
    logLevel: 'silent'
});

// Optional bundles import only types from the root. Keep its
// segmentation and random-symbol machinery outside the default runtime.
for (const optional of ['censor', 'evasion']) await build({
    entryPoints: [fileURLToPath(new URL(`../src/${optional}.ts`, import.meta.url))],
    outfile: fileURLToPath(new URL(`../dist/cjs/${optional}.js`, import.meta.url)),
    bundle: true,
    format: 'cjs',
    platform: 'neutral',
    target: 'es2022',
    minify: true,
    logLevel: 'silent'
});

// Each ESM facade aliases its CommonJS implementation. Runtime objects and
// declaration identities are shared when consumers mix import and require.
const directory = new URL('../dist/esm/', import.meta.url);
await mkdir(directory, { recursive: true });
for (const entry of ['index', 'censor', 'evasion']) {
    const api = require(`../dist/cjs/${entry}.js`);
    const names = Object.keys(api).filter((name) => name !== 'default' && name !== '__esModule');
    for (const name of names) {
        if (!/^[A-Za-z_$][\w$]*$/u.test(name)) {
            throw new Error(`Cannot generate ESM facade for export ${JSON.stringify(name)}`);
        }
    }
    const hasDefault = Object.hasOwn(api, 'default');
    await writeFile(new URL(`${entry}.js`, directory), [
        '// Generated facade: the CommonJS module owns all runtime state.',
        `import api from '../cjs/${entry}.js';`,
        ...names.map((name) => `export const ${name} = api.${name};`),
        ...(hasDefault ? ['export default api.default;'] : []),
        ''
    ].join('\n'));
    await writeFile(new URL(`${entry}.d.ts`, directory), [
        `export * from '../cjs/${entry}.js';`,
        ...(hasDefault ? [
            `declare const instance: typeof import('../cjs/${entry}.js').default;`,
            'export default instance;'
        ] : []),
        ''
    ].join('\n'));
}
