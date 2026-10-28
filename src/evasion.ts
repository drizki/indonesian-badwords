import type { EvasionCompiler, EvasionPolicy } from './evasion-types.ts';
import { compileEvasion, type CompiledOptions } from './evasion-scan.ts';
export type { EvasionPolicy } from './evasion-types.ts';

export type EvasionLimit = 'input' | 'states' | 'steps' | 'compileStates' | 'dictionaryLength';
/** A complete answer could not be produced within the selected resource budget. */
export class EvasionLimitError extends RangeError {
    readonly limit: EvasionLimit;
    readonly maximum: number;
    readonly used: number;
    constructor(limit: EvasionLimit, maximum: number, used: number) {
        super(`Evasion ${limit} limit exceeded (${maximum})`);
        this.name = 'EvasionLimitError';
        this.limit = limit; this.maximum = maximum; this.used = used;
    }
}

export interface EvasionOptions {
    /** Transform only ASCII Latin dictionary keys within these lengths. Defaults to 4 and 64. */
    readonly minLength?: number;
    readonly maxLength?: number;
    readonly separators?: {
        readonly characters: readonly string[];
        readonly maxGap: number;
        readonly maxTotal: number;
    };
    readonly repetitions?: {
        readonly maxExtraPerLetter: number;
        readonly maxTotal: number;
    };
    readonly confusables?: {
        readonly mappings: readonly (readonly [string, string])[];
        readonly maxTotal: number;
        /** Require one unmapped canonical ASCII input letter. Defaults to true. */
        readonly requireAsciiLetter?: boolean;
    };
    readonly limits?: {
        /** Original UTF-16 length. Defaults to 1,000,000. */
        readonly maxInputLength?: number;
        /** Unique active states per input position. Defaults to 4,096; maximum 1,048,576. */
        readonly maxStates?: number;
        /** State visits, attempted transitions, and candidate inspections. Defaults to 10,000,000. */
        readonly maxSteps?: number;
        /** Shared trie states, including its root. Defaults to 65,536. */
        readonly maxCompileStates?: number;
        /** Supplied and canonical dictionary UTF-16 material. Defaults to 1,000,000. */
        readonly maxDictionaryLength?: number;
    };
}

/** Selected Unicode 17.0.0 one-letter mappings; see THIRD_PARTY_NOTICES. */
export const latinLookalikes: readonly (readonly [string, string])[] = Object.freeze([
    ['а', 'a'], ['е', 'e'], ['о', 'o'], ['р', 'p'], ['с', 'c'], ['у', 'y'],
    ['х', 'x'], ['і', 'i'], ['ј', 'j'], ['ѕ', 's'], ['ο', 'o'], ['ρ', 'p']
].map(pair => Object.freeze(pair as [string, string])));

const UINT32 = 0xffff_ffff;
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
function integer(value: unknown, name: string, minimum = 0, maximum = UINT32): number {
    if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum)
        throw new RangeError(`${name} must be an integer between ${minimum} and ${maximum}`);
    return value as number;
}
function scalar(value: unknown): value is string {
    return typeof value === 'string' && [...value].length === 1 && !/[\uD800-\uDFFF]/u.test(value);
}

/** Compile explicit bounded transformations; omitted transformation families are disabled. */
export function boundedEvasion(options: EvasionOptions): EvasionPolicy {
    const input = object(options, ['minLength', 'maxLength', 'separators', 'repetitions', 'confusables', 'limits'], 'evasion');
    const minLength = integer(input.minLength === undefined ? 4 : input.minLength, 'minLength', 1);
    const maxLength = integer(input.maxLength === undefined ? 64 : input.maxLength, 'maxLength', minLength);
    let separators: string[] = [], maxGap = 0, maxGaps = 0, extra = 0, maxRepeats = 0;
    let mappings: Array<readonly [string, string]> = [], maxConfusables = 0, requireAsciiLetter = true;
    if (input.separators !== undefined) {
        const item = object(input.separators, ['characters', 'maxGap', 'maxTotal'], 'separators');
        if (!Array.isArray(item.characters) || !item.characters.length) throw new TypeError('characters must be a nonempty array');
        for (const character of item.characters) {
            if (!scalar(character) || !/^[\p{P}\p{Zs}]$/u.test(character) || /\p{Default_Ignorable_Code_Point}/u.test(character))
                throw new TypeError('separators must be single punctuation or horizontal-space scalars');
            separators.push(character);
        }
        separators = [...new Set(separators)];
        maxGap = integer(item.maxGap, 'maxGap', 1);
        maxGaps = integer(item.maxTotal, 'separators.maxTotal', maxGap);
    }
    if (input.repetitions !== undefined) {
        const item = object(input.repetitions, ['maxExtraPerLetter', 'maxTotal'], 'repetitions');
        extra = integer(item.maxExtraPerLetter, 'maxExtraPerLetter', 1);
        maxRepeats = integer(item.maxTotal, 'repetitions.maxTotal', extra);
    }
    if (input.confusables !== undefined) {
        const item = object(input.confusables, ['mappings', 'maxTotal', 'requireAsciiLetter'], 'confusables');
        if (!Array.isArray(item.mappings) || !item.mappings.length) throw new TypeError('mappings must be a nonempty tuple array');
        for (const candidate of item.mappings) {
            if (!Array.isArray(candidate) || candidate.length !== 2) throw new TypeError('each mapping must be a tuple');
            const pair = [candidate[0], candidate[1]];
            if (!scalar(pair[0]) || (!/^\p{L}$/u.test(pair[0]) || /\p{Grapheme_Extend}/u.test(pair[0]))
                || typeof pair[1] !== 'string' || !/^[a-z]$/i.test(pair[1]))
                throw new TypeError('each mapping must contain one source letter and one ASCII Latin target letter');
            mappings.push(Object.freeze([pair[0], pair[1]]));
        }
        maxConfusables = integer(item.maxTotal, 'confusables.maxTotal', 1);
        if (item.requireAsciiLetter !== undefined && typeof item.requireAsciiLetter !== 'boolean')
            throw new TypeError('requireAsciiLetter must be a boolean');
        requireAsciiLetter = item.requireAsciiLetter === undefined ? true : item.requireAsciiLetter;
    }
    if (!maxGap && !extra && !maxConfusables) throw new TypeError('Select at least one bounded transformation');
    const limits = input.limits === undefined ? {} : object(input.limits,
        ['maxInputLength', 'maxStates', 'maxSteps', 'maxCompileStates', 'maxDictionaryLength'], 'limits');
    const config: CompiledOptions = Object.freeze({ minLength, maxLength,
        separators: Object.freeze(separators), mappings: Object.freeze(mappings), maxGap, maxGaps,
        extra, maxRepeats, maxConfusables, requireAsciiLetter,
        maxInputLength: integer(limits.maxInputLength === undefined ? 1_000_000 : limits.maxInputLength, 'maxInputLength', 1),
        maxStates: integer(limits.maxStates === undefined ? 4096 : limits.maxStates, 'maxStates', 1, 1_048_576),
        maxSteps: integer(limits.maxSteps === undefined ? 10_000_000 : limits.maxSteps, 'maxSteps', 1, Number.MAX_SAFE_INTEGER),
        maxCompileStates: integer(limits.maxCompileStates === undefined ? 65_536 : limits.maxCompileStates, 'maxCompileStates', 1),
        maxDictionaryLength: integer(limits.maxDictionaryLength === undefined ? 1_000_000 : limits.maxDictionaryLength, 'maxDictionaryLength', 1)
    });
    const fail = (limit: EvasionLimit, maximum: number, used: number): never => { throw new EvasionLimitError(limit, maximum, used); };
    const compiler = Object.freeze<EvasionCompiler>({
        checkDictionary(words: readonly string[]) {
            let length = 0;
            for (const word of words) {
                length += word.length;
                if (length > config.maxDictionaryLength) fail('dictionaryLength', config.maxDictionaryLength, length);
            }
        },
        compile: (entries, normalization, canonicalize, trie, candidateText) => compileEvasion(config, entries, normalization, canonicalize, trie, candidateText, fail)
    });
    return Object.freeze({ [Symbol.for('indonesian-badwords.evasion.v1')]: compiler }) as unknown as EvasionPolicy;
}
