import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, existsSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, relative, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const archive = resolve(process.argv[2] ?? '');
assert.ok(process.argv[2] && existsSync(archive), 'Pass a packed release tarball.');
const walk = path => readdirSync(path, { withFileTypes: true }).flatMap(entry => {
  if (['node_modules', 'dist', '.policy', 'test-results', 'playwright-report'].includes(entry.name)) return [];
  const name = join(path, entry.name);
  return entry.isDirectory() ? walk(name) : name.endsWith('.md') ? [name] : [];
});
const files = [join(root, 'README.md'), join(root, 'README.id.md'), ...walk(join(root, 'docs')), ...walk(join(root, 'examples'))];
const blocks = text => [...text.matchAll(/^```(ts|js)\n([\s\S]*?)^```/gm)];
const markdown = new Map(files.map(file => [file, readFileSync(file, 'utf8')]));
const stripCode = text => text.replace(/^```[^\n]*\n[\s\S]*?^```/gm, '');
const slug = value => value.toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}_\-\s]/gu, '').replace(/ /g, '-');
function anchors(text) {
  const seen = new Map();
  return new Set([...stripCode(text).matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => {
    const base = slug(match[1]);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  }));
}
let links = 0;
for (const [file, text] of markdown) {
  for (const match of stripCode(text).matchAll(/(?:\[[^\]\n]*\]\(|\bsrc=")([^\s)"<>]+)(?:\)|")/g)) {
    let target = match[1];
    const own = /^https:\/\/(?:github\.com\/drizki\/indonesian-badwords\/(?:blob|tree)\/main\/|raw\.githubusercontent\.com\/drizki\/indonesian-badwords\/main\/)/;
    let base = dirname(file);
    if (own.test(target)) { target = target.replace(own, ''); base = root; }
    else if (/^[a-z]+:/i.test(target)) continue;
    const [path, anchor] = target.split('#');
    const destination = resolve(base, decodeURIComponent(path || relative(base, file)));
    assert.ok(existsSync(destination), `${relative(root, file)}: broken link ${match[1]}`);
    if (anchor && statSync(destination).isFile() && destination.endsWith('.md')) {
      assert.ok(anchors(readFileSync(destination, 'utf8')).has(decodeURIComponent(anchor)), `${relative(root, file)}: missing anchor ${match[1]}`);
    }
    links++;
  }
}
const english = blocks(markdown.get(join(root, 'README.md'))).map(block => block[2]);
const indonesian = blocks(markdown.get(join(root, 'README.id.md'))).map(block => block[2]);
assert.deepEqual(indonesian, english, 'README code must remain identical across languages.');

const consumer = mkdtempSync(join(tmpdir(), 'badwords-docs-'));
let executed = 0;
let assertions = 0;
try {
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({ private: true, type: 'module' }));
  execFileSync('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', archive], { cwd: consumer, stdio: 'pipe' });
  const types = [];
  for (const [file, text] of markdown) for (const [index, block] of blocks(text).entries()) {
    const code = block[2].replace(/^(.+?);\s*\/\/ => (.+)$/gm, (_line, expression, expected) => {
      assertions++;
      return `assert.deepEqual(${expression.trim()}, ${expected});`;
    });
    const name = `${String(executed).padStart(3, '0')}`;
    // Type-check authored TS, then execute each example in its own normal Node realm.
    if (block[1] === 'ts') {
      const source = join(consumer, `${name}.ts`);
      writeFileSync(source, block[2]);
      types.push(source);
    }
    const runnable = join(consumer, `${name}.cjs`);
    writeFileSync(runnable, "const assert = require('node:assert/strict');\n" + transformSync(code, { loader: block[1] === 'ts' ? 'ts' : 'js', format: 'cjs', target: 'es2022' }).code);
    try { execFileSync(process.execPath, [runnable], { cwd: consumer, stdio: 'pipe' }); }
    catch (error) { throw new Error(`${relative(root, file)} example ${index + 1}: ${error.stderr?.toString() ?? error.message}`); }
    executed++;
  }
  try {
    execFileSync(process.execPath, [join(root, 'examples/node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', ...types], { cwd: consumer, stdio: 'pipe' });
  } catch (error) {
    throw new Error(`Markdown TypeScript failed:\n${error.stdout?.toString() ?? ''}${error.stderr?.toString() ?? error.message}`);
  }
  // README tables describe these complete product journeys; verify their outputs too.
  writeFileSync(join(consumer, 'claims.mjs'), `
    import assert from 'node:assert/strict';
    import { Badwords, dictionary, contextualDictionary, expandedDictionary } from 'indonesian-badwords';
    import { boundedEvasion, latinLookalikes } from 'indonesian-badwords/evasion';
    import { boundedFuzzy } from 'indonesian-badwords/fuzzy';
    import { mask } from 'indonesian-badwords/censor';
    import { reviewedDictionary, reviewedExpandedDictionary } from 'indonesian-badwords/metadata';
    assert.deepEqual([dictionary.length, contextualDictionary.length, expandedDictionary.length, reviewedDictionary.length, reviewedExpandedDictionary.length], [227,117,344,172,266]);
    const tolerant = new Badwords({
      fuzzy: boundedFuzzy({ model: 'osa', maxEdits: 1 }),
      evasion: boundedEvasion({
        separators: { characters: [' ', '.', '_', '-'], maxGap: 1, maxTotal: 8 },
        repetitions: { maxExtraPerLetter: 2, maxTotal: 8 },
        confusables: { mappings: latinLookalikes, maxTotal: 2 },
      }),
    });
    for (const spelling of ['g-o-b-l-o-k', 'gobloook', 'gοblοk', 'goblox', 'golbok', 'g-o-b-l-o-x']) {
      assert.equal(tolerant.censor('dasar ' + spelling + '!'), 'dasar ***!');
    }
    const checker = new Badwords();
    assert.equal(checker.censor('dasar g0bl0k!', mask({ keepFirst: 1, keepLast: 1 })), 'dasar g****k!');
    assert.equal(checker.censor('dasar g0bl0k!', ({ words }) => '[' + words[0] + ']'), 'dasar [goblok]!');
    assert.equal(checker.flag('ＧＯＢＬＯＫ'), true);
    assert.equal(checker.flag('go\\u200bblok'), true);
  `);
  execFileSync(process.execPath, [join(consumer, 'claims.mjs')], { cwd: consumer, stdio: 'pipe' });
  assert.ok(assertions >= 20, 'Keep executable expected-output assertions in the guides.');
  console.log(`Verified ${links} local links/anchors, ${executed} executable examples, ${assertions} annotated outputs, README parity, and capability tables against the tarball.`);
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
