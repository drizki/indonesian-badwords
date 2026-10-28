import type { CensorSpan, Entry, Match, MatcherNode } from './matcher.ts';
import type { Normalization, NormalizedText } from './normalize.ts';

declare const policyBrand: unique symbol;
/** An immutable policy created by the optional `indonesian-badwords/evasion` module. */
export interface EvasionPolicy { readonly [policyBrand]: true }

/** Internal capability contract; optional implementation code stays out of the root bundle. */
export interface EvasionRuntime {
    checkInput(text: string): void;
    potential(text: string): boolean;
    scan(value: NormalizedText, wholeWords: boolean, visit: (match: Match) => boolean | void,
        selection: 'all' | 'spans' | 'unique', accept?: (start: number, end: number) => boolean): void;
    censor(value: NormalizedText, wholeWords: boolean,
        accept?: (start: number, end: number) => boolean): CensorSpan[];
}
export interface TrieLimit { maximum: number; exceeded: (used: number) => never }
export interface EvasionPlan {
    readonly version: 1;
    readonly minLength: number; readonly maxLength: number;
    readonly gaps: ReadonlySet<number>; readonly mappings: ReadonlyMap<number, number>;
    readonly maxGap: number; readonly maxGaps: number; readonly extra: number; readonly maxRepeats: number;
    readonly maxConfusables: number; readonly requireAsciiLetter: boolean;
    readonly maxInputLength: number; readonly maxStates: number; readonly maxSteps: number;
    readonly maxCompileStates: number; readonly maxDictionaryLength: number;
    exceeded(limit: 'input' | 'states' | 'steps' | 'compileStates' | 'dictionaryLength', maximum: number, used: number): never;
}
export interface EvasionCompiler {
    readonly dictionaryLimit?: { readonly maximum: number; exceeded(used: number): never };
    plan?(normalization: Normalization, canonicalize: (text: string, normalization: Normalization) => string): EvasionPlan;
    checkDictionary(words: readonly string[]): void;
    compile(entries: readonly Entry[], normalization: Normalization,
        canonicalize: (text: string, normalization: Normalization) => string,
        trie: (limit: TrieLimit) => readonly MatcherNode[], candidateText: (text: string) => string | undefined): EvasionRuntime;
}
