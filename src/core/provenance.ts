import type { Match } from './matcher.ts';
import { normalize, normalizeLiteral, type Normalization } from '../text/normalize.ts';

/** Counts of bounded evasion transforms applied to reach a dictionary word. */
export interface EvasionTransforms {
    /** Separator characters skipped, such as the dots in b.a.n.g.s.a.t. */
    separators: number;
    /** Repeated letters collapsed, such as the extra o in goooblok. */
    repetitions: number;
    /** Configured confusable letters mapped, such as Cyrillic look-alikes. */
    confusables: number;
}

/** How one occurrence matched. Kinds run from the most literal to the loosest. */
export type MatchVia =
    | { kind: 'exact' }
    | { kind: 'normalized' }
    /** `folds` counts digits or symbols folded into letters. */
    | { kind: 'leetspeak'; folds: number }
    | { kind: 'evasion'; transforms: EvasionTransforms }
    /** `transforms` is present only when evasion transforms were also used. */
    | { kind: 'fuzzy'; edits: number; model: 'levenshtein' | 'osa'; transforms?: EvasionTransforms };

const ASCII = /^[\x00-\x7f]*$/;
const EXACT: MatchVia = Object.freeze({ kind: 'exact' });
const NORMALIZED: MatchVia = Object.freeze({ kind: 'normalized' });
const collapse = (text: string) => normalize(text, 'none', true).text;
const counts = (separators: number, repetitions: number, confusables: number): EvasionTransforms =>
    Object.freeze({ separators, repetitions, confusables });

// Common non-ASCII spellings (fullwidth, invisible characters) normalize with the built-ins alone.
const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]/g;
function cheap(source: string, word: string): string | undefined {
    const text = source.replace(INVISIBLE, '').normalize('NFKC').toLowerCase();
    return text === word ? text : undefined;
}

export interface ProvenanceSettings { normalization: Normalization; ignoreRepeatedLetters: boolean }

/**
 * Post hoc, from the source slice and the dictionary word, unless a scanner supplied a trace.
 * A match already guarantees that folding the literal text yields the word, so leetspeak
 * needs no second normalization: its fold count is where the literal text differs from the word.
 */
export function describe(source: string, match: Match, settings: ProvenanceSettings): MatchVia {
    const trace = match.trace;
    const transforms = trace && trace.gaps + trace.repeats + trace.maps > 0 ? counts(trace.gaps, trace.repeats, trace.maps) : undefined;
    if (trace && trace.edits > 0) return Object.freeze({ kind: 'fuzzy', edits: trace.edits, model: trace.model!, ...(transforms && { transforms }) });
    if (transforms) return Object.freeze({ kind: 'evasion', transforms });
    const word = match.word;
    if (source === word) return EXACT;
    const literal = settings.normalization !== 'standard' ? source
        : ASCII.test(source) ? source.toLowerCase() : cheap(source, word) ?? normalizeLiteral(source, 'standard').text;
    if (literal === word) return NORMALIZED;
    if (settings.ignoreRepeatedLetters) {
        const collapsed = collapse(literal);
        // Counts repeated letters actually collapsed in the source; 0 when the word itself has doubles the source lacks.
        if (collapsed === collapse(word)) return Object.freeze({ kind: 'evasion', transforms: counts(0, literal.length - collapsed.length, 0) });
    }
    let folds = 0;
    // Repeat folding can change the length; then count the folding symbols themselves.
    if (literal.length !== word.length) folds = literal.match(/[0-9@$(|!]/g)?.length ?? 0;
    else for (let index = 0; index < word.length; index++) if (word[index] !== literal[index]) folds++;
    return Object.freeze({ kind: 'leetspeak', folds: Math.max(1, folds) });
}

/**
 * Per-call lazy lookup of the occurrences inside a merged span, scanned once on first use. When the scan was truncated
 * and the span reaches past the last kept occurrence (so a dropped occurrence could lie inside it), the result carries
 * a non-enumerable `truncated: true`, the same convention as find().
 */
export function occurrencesWithin<Location extends { index: number; end: number }>(load: () => readonly Location[] & { readonly truncated?: true }) {
    let all: (readonly Location[] & { readonly truncated?: true }) | undefined;
    return (span: { readonly index: number; readonly end: number }): readonly Location[] & { readonly truncated?: true } => {
        all ??= load();
        // Ordered by start: binary-search the first candidate.
        let low = 0, high = all.length;
        while (low < high) { const middle = (low + high) >> 1; if (all[middle].index < span.index) low = middle + 1; else high = middle; }
        const inside: Location[] = [];
        for (let at = low; at < all.length && all[at].index < span.end; at++) if (all[at].end <= span.end) inside.push(all[at]);
        if (all.truncated && span.end > all[all.length - 1].index) Object.defineProperty(inside, 'truncated', { value: true });
        return Object.freeze(inside);
    };
}
