import { createRequire } from 'node:module';
import { join } from 'node:path';

// Helpers shared by the benchmark, paired, comparison and budget scripts, so a policy, an input or a
// statistic is defined once. Nothing here times anything or touches the network.

const separators = (characters) => ({ characters, maxGap: 1, maxTotal: 8 });
const repetitions = { maxExtraPerLetter: 2, maxTotal: 8 };
/** Bounded evasion policy used by the maintained benchmark, the paired tool and the budgets (`-` and `_`). */
export const boundedEvasionPolicy = { separators: separators(['-', '_']), repetitions };
/** The wider policy of the public comparison page (`- _ . *`). */
export const wideEvasionPolicy = { separators: separators(['-', '_', '.', '*']), repetitions };

/**
 * Build a checker of this package from a built CommonJS directory (`dist/cjs`).
 * `policy` is `{ options, evasion, fuzzy }`: `evasion`/`fuzzy` are bounded-policy arguments.
 */
export function createChecker(cjsDirectory, policy = {}) {
    const load = createRequire(join(cjsDirectory, 'index.js'));
    const options = { ...policy.options };
    if (policy.evasion) options.evasion = load('./evasion.js').boundedEvasion(policy.evasion);
    if (policy.fuzzy) options.fuzzy = load('./fuzzy.js').boundedFuzzy(policy.fuzzy);
    return new (load('./index.js').Badwords)(options);
}

/** Percentile of unsorted values: the ceil(n * fraction)-th smallest. `percentile(v, 0.5)` is the median. */
export function percentile(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length, Math.max(1, Math.ceil(sorted.length * fraction))) - 1];
}
export const median = (values) => percentile(values, 0.5);

/**
 * Identifiers that make otherwise identical inputs distinct (so single-input caches cannot help) without
 * changing length or structure: `q` + two letters + `q`. Candidates some filter reads as a word are
 * rejected here; the comparison script re-screens every candidate it uses against every configuration
 * and fails on any it finds flagged, so this list cannot silently go stale.
 */
// Read as "kondom" by @sideid/id-profanity-filter 1.13.0 with `detectSplit` (found by screening all 676 candidates, 2026-10-30).
export const rejectedIdentifiers = ['qcdq', 'qmlq', 'qsuq'];
const pool = Array.from({ length: 676 }, (_, number) => `q${String.fromCharCode(97 + Math.floor(number / 26), 97 + number % 26)}q`)
    .filter((value) => !rejectedIdentifiers.includes(value));
export function identifier(index) {
    if (!(index >= 0 && index < pool.length)) throw new RangeError(`No identifier ${index}`);
    return pool[index];
}
export const identifiers = (count) => pool.slice(0, count);

/** Cheap consumption of a result so a call cannot be optimised away; the same for every package. */
export function sink(result) {
    if (typeof result === 'boolean') return result ? 1 : 0;
    if (typeof result === 'string' || Array.isArray(result)) return result.length;
    return result?.locations?.length ?? (result ? 1 : 0);
}

/** Environment for third-party worker processes: nothing but what Node.js needs to start. */
export const minimalEnvironment = () => ({ PATH: process.env.PATH ?? '', ...(process.env.BENCHMARK_PROGRESS ? { BENCHMARK_PROGRESS: '1' } : {}) });
