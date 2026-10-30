import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';

/**
 * Minified browser bundle (ES2022, ESM) of `contents`, resolved from `resolveDir`, and its gzip level 9 size.
 * Minified bytes do not depend on the Node.js version; gzip bytes depend on the zlib that Node.js bundles
 * (`process.versions.zlib`), so record it next to any gzip figure.
 */
export async function bundleSize(contents, resolveDir) {
    const result = await build({ stdin: { contents, resolveDir }, bundle: true, platform: 'browser', target: 'es2022', format: 'esm',
        minify: true, legalComments: 'none', write: false, logLevel: 'silent' });
    const output = result.outputFiles[0].contents;
    return { minifiedBytes: output.length, gzipBytes: gzipSync(output, { level: 9 }).length };
}
