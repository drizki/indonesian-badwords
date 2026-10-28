import type { FuzzyConfig, FuzzyCompiler, FuzzyPolicy } from './fuzzy-types.ts';
import { compileFuzzy } from './fuzzy-scan.ts';
export type { FuzzyPolicy } from './fuzzy-types.ts';

export type FuzzyLimit = 'input' | 'states' | 'steps' | 'compileStates' | 'dictionaryLength' | 'indexPostings' | 'candidates' | 'stateCells';
/** A complete answer could not be produced within the selected resource budget. */
export class FuzzyLimitError extends RangeError {
    readonly limit: FuzzyLimit;
    readonly maximum: number;
    readonly used: number;
    constructor(limit: FuzzyLimit, maximum: number, used: number) {
        super(`Fuzzy ${limit} limit exceeded (${maximum})`);
        this.name = 'FuzzyLimitError'; this.limit = limit; this.maximum = maximum; this.used = used;
    }
}
export interface FuzzyOptions {
    /** Unit edits from dictionary key to candidate. Defaults to 1; range 0–64. */
    readonly maxEdits?: number;
    /** OSA adds restricted adjacent transpositions, even when all other edits are disabled. */
    readonly model?: 'levenshtein' | 'osa';
    readonly insertions?: boolean;
    readonly deletions?: boolean;
    readonly substitutions?: boolean;
    /** Eligible lexical keys must contain a letter. Defaults to 5–64 Unicode scalars. */
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly limits?: {
        readonly maxInputLength?: number;
        readonly maxStates?: number;
        readonly maxSteps?: number;
        readonly maxCompileStates?: number;
        readonly maxDictionaryLength?: number;
        readonly maxIndexPostings?: number;
        readonly maxCandidates?: number;
        /** Numeric workspace cells plus simultaneous UTF-16 projection-string cells. Defaults to 1,000,000. */
        readonly maxStateCells?: number;
    };
}
function object(value: unknown, keys: readonly string[], name: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new TypeError(`${name} must be an object`);
    const copy: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || !keys.includes(key)) throw new TypeError(`Unknown ${name} option: ${String(key)}`);
        copy[key] = Reflect.get(value, key);
    }
    return copy;
}
function integer(value: unknown, name: string, minimum = 1, maximum = 0xffff_ffff): number {
    if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
        throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
    return value as number;
}
/** Explicit bounded scalar edits; omitted edit families are enabled. */
export function boundedFuzzy(options: FuzzyOptions = {}): FuzzyPolicy {
    const input = object(options, ['maxEdits', 'model', 'insertions', 'deletions', 'substitutions', 'minLength', 'maxLength', 'limits'], 'fuzzy');
    const model = input.model === undefined ? 'levenshtein' : input.model;
    if (model !== 'levenshtein' && model !== 'osa') throw new TypeError('invalid fuzzy model');
    for (const family of ['insertions', 'deletions', 'substitutions'])
        if (input[family] !== undefined && typeof input[family] !== 'boolean') throw new TypeError(`${family} must be a boolean`);
    const minLength = integer(input.minLength === undefined ? 5 : input.minLength, 'minLength');
    const limits = input.limits === undefined ? {} : object(input.limits,
        ['maxInputLength', 'maxStates', 'maxSteps', 'maxCompileStates', 'maxDictionaryLength', 'maxIndexPostings', 'maxCandidates', 'maxStateCells'], 'limits');
    const budget = (key: string, fallback: number, maximum = 0xffff_ffff) => integer(limits[key] === undefined ? fallback : limits[key], key, 1, maximum);
    const config: FuzzyConfig = Object.freeze({ model,
        maxEdits: integer(input.maxEdits === undefined ? 1 : input.maxEdits, 'maxEdits', 0, 64), minLength,
        maxLength: integer(input.maxLength === undefined ? 64 : input.maxLength, 'maxLength', minLength),
        insertions: input.insertions !== false, deletions: input.deletions !== false, substitutions: input.substitutions !== false,
        maxInputLength: budget('maxInputLength', 1_000_000), maxStates: budget('maxStates', 4096, 1_048_576),
        maxSteps: budget('maxSteps', 10_000_000, Number.MAX_SAFE_INTEGER), maxCompileStates: budget('maxCompileStates', 65_536),
        maxDictionaryLength: budget('maxDictionaryLength', 1_000_000), maxIndexPostings: budget('maxIndexPostings', 250_000),
        maxCandidates: budget('maxCandidates', 100_000), maxStateCells: budget('maxStateCells', 1_000_000)
    });
    const fail = (limit: FuzzyLimit, maximum: number, used: number): never => { throw new FuzzyLimitError(limit, maximum, used); };
    const compiler = Object.freeze<FuzzyCompiler>({
        checkDictionary(words, evasion) {
            let length = 0;
            for (const word of words) {
                length += word.length;
                if (evasion?.dictionaryLimit && evasion.dictionaryLimit.maximum < config.maxDictionaryLength) {
                    if (length > evasion.dictionaryLimit.maximum) evasion.dictionaryLimit.exceeded(length);
                } else if (length > config.maxDictionaryLength) fail('dictionaryLength', config.maxDictionaryLength, length);
            }
        },
        compile: (entries, normalization, canonicalize, trie, candidateText, evasion) =>
            compileFuzzy(config, entries, normalization, canonicalize, trie, candidateText, fail, evasion)
    });
    return Object.freeze({ [Symbol.for('indonesian-badwords.fuzzy.v1')]: compiler }) as unknown as FuzzyPolicy;
}
