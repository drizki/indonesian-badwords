import type { Normalization } from '../text/normalize.ts';
import type { MatchVia } from './provenance.ts';
import type { FuzzyPolicy } from '../fuzzy/types.ts';
import type { EvasionPolicy } from '../evasion/types.ts';
import type { MaxMatchesMode } from './pipeline.ts';

/** One occurrence with exclusive end and UTF-16 offsets into the original input. */
export interface BadwordLocation {
    word: string;
    index: number;
    end: number;
    /** Exact matched source text, including any obfuscation. */
    match: string;
}
/** An occurrence from find() or analyze(), with how it matched; the most literal path when several reach the same span. */
export interface MatchedLocation extends BadwordLocation {
    readonly via: MatchVia;
}

/** One merged source span passed to a censorship callback. */
export interface CensorContext {
    readonly text: string;
    readonly index: number;
    readonly end: number;
    readonly match: string;
    /** Unique contributing dictionary words, in dictionary insertion order. */
    readonly words: readonly string[];
}
/** The context censor() passes: a non-enumerable method lists the occurrences behind the span. */
export interface DetailedCensorContext extends CensorContext {
    /** Lazy and non-enumerable. Scans once per censor() call, honours the call's exceptions, and can throw find()'s RangeError or, if the dictionary changed during the call, a TypeError. */
    occurrences(): readonly MatchedLocation[];
}
export type CensorCallback = (context: CensorContext) => string;
export type CensorReplacement = string | CensorCallback;

/** A half-open UTF-16 range in the original input, on complete grapheme boundaries. */
export interface IgnoreRange {
    readonly index: number;
    readonly end: number;
}
export interface CheckOptions {
    /** Ignore every occurrence intersecting these source ranges. Empty ranges are no-ops. */
    readonly ignoreRanges?: readonly IgnoreRange[];
}

/** Options for filter(). */
export interface FilterOptions extends CheckOptions {
    /**
     * Keep line breaks instead of collapsing them into spaces. Defaults to false. A whitespace run that
     * contains line breaks (LF, CR, CRLF, U+2028, U+2029) becomes exactly those breaks, verbatim: CRLF stays
     * one unit, blank lines are kept, and spaces or tabs around a break (such as trailing whitespace on a
     * line) are dropped. Runs without a line break still become one space, and the result is still trimmed.
     */
    readonly preserveLineBreaks?: boolean;
}
/** Options for find(). */
export interface FindOptions extends CheckOptions {
    /** Overrides the checker's onMaxMatches for this call. */
    readonly onMaxMatches?: MaxMatchesMode;
}
/** Options for analyze(). */
export interface AnalyzeOptions extends FindOptions {
    /** Replaces each merged span in `censored`, exactly as censor() does. Defaults to '***'. */
    readonly replacement?: string | ((context: DetailedCensorContext) => string);
}
/**
 * find() output. `truncated` exists, as true, only when onMaxMatches: 'truncate' dropped occurrences. It is a
 * non-enumerable property of the array, so deep equality, JSON and spreading ignore it; read it as `result.truncated`.
 */
export type FindResult = MatchedLocation[] & { readonly truncated?: true };

export interface AnalysisResult {
    text: string;
    /** Nonempty whitespace-separated tokens, not linguistic word segmentation. */
    words: number;
    censored: string;
    /** Unique dictionary words in dictionary insertion order. */
    badwords: string[];
    /** Unique matched dictionary words. */
    count: number;
    /** Every occurrence, including overlapping dictionary matches. */
    occurrenceCount: number;
    locations: MatchedLocation[];
}

/** analyze() output. */
export interface AnalysisReport extends AnalysisResult {
    /**
     * Present, and true, only when onMaxMatches: 'truncate' dropped occurrences; `locations` then holds the first
     * maxMatches in source order. Absent otherwise, so untruncated results keep their 2.6 shape (deep equality, snapshots).
     */
    readonly truncated?: true;
}

export type MatchMode = 'substring' | 'word';
export interface BadwordsOptions {
    /** Explicit bounded transformations from the optional /evasion module. */
    evasion?: EvasionPolicy;
    /** Explicit bounded edits from the optional /fuzzy module. */
    fuzzy?: FuzzyPolicy;
    dictionary?: readonly string[];
    /** Literal whole-word phrases exempt only occurrences fully contained inside them. */
    allowPhrases?: readonly string[];
    /** Defaults to whole-word matching. */
    mode?: MatchMode;
    /** Standard: NFKC, lowercase, invisible-character removal and internal leetspeak. */
    normalization?: Normalization;
    /** Opt in to stretched spellings such as gooooblok. Defaults to false. */
    ignoreRepeatedLetters?: boolean;
    /** Maximum detailed occurrences for find/analyze. Defaults to 10,000; Infinity disables the cap. */
    maxMatches?: number;
    /** What find() and analyze() do past maxMatches: throw a RangeError (default) or keep the first maxMatches occurrences and set `truncated`. */
    onMaxMatches?: MaxMatchesMode;
}
