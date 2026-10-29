import type { EvasionCompiler, EvasionRuntime } from '../evasion/types.ts';
import type { Entry, MatcherNode } from '../core/matcher.ts';
import type { Normalization } from '../text/normalize.ts';
import type { TrieLimit } from '../evasion/types.ts';

declare const policyBrand: unique symbol;
/** An immutable policy created by the optional `indonesian-badwords/fuzzy` module. */
export interface FuzzyPolicy { readonly [policyBrand]: true }
export interface FuzzyCompiler {
    readonly version: 2;
    checkDictionary(words: readonly string[], evasion?: EvasionCompiler): void;
    compile(entries: readonly Entry[], normalization: Normalization,
        canonicalize: (text: string, normalization: Normalization) => string,
        trie: (limit: TrieLimit) => readonly MatcherNode[], candidateText: (text: string) => string | undefined,
        evasion?: EvasionCompiler): EvasionRuntime;
}
export interface FuzzyConfig {
    readonly maxEdits: number; readonly model: 'levenshtein' | 'osa';
    readonly insertions: boolean; readonly deletions: boolean; readonly substitutions: boolean;
    readonly minLength: number; readonly maxLength: number;
    readonly maxInputLength: number; readonly maxStates: number; readonly maxSteps: number;
    readonly maxCompileStates: number; readonly maxDictionaryLength: number;
    readonly maxIndexPostings: number; readonly maxCandidates: number; readonly maxStateCells: number;
}
