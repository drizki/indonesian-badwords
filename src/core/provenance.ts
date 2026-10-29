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

const EXACT: MatchVia = Object.freeze({ kind: 'exact' });
const NORMALIZED: MatchVia = Object.freeze({ kind: 'normalized' });
const collapse = (text: string) => normalize(text, 'none', true).text;

export interface ProvenanceSettings { normalization: Normalization; ignoreRepeatedLetters: boolean }

/** Post hoc: compare the source slice with the dictionary word, unless a scanner supplied a trace. */
export function describe(source: string, match: Match, settings: ProvenanceSettings): MatchVia {
    const trace = match.trace;
    const transforms = trace && trace.gaps + trace.repeats + trace.maps > 0
        ? { separators: trace.gaps, repetitions: trace.repeats, confusables: trace.maps } : undefined;
    if (trace && trace.edits > 0) return { kind: 'fuzzy', edits: trace.edits, model: trace.model!, ...(transforms && { transforms }) };
    if (transforms) return { kind: 'evasion', transforms };
    if (source === match.word) return EXACT;
    const literal = settings.normalization === 'standard' ? normalizeLiteral(source, 'standard').text : source;
    if (literal === match.word) return NORMALIZED;
    if (settings.ignoreRepeatedLetters && collapse(literal) === collapse(match.word)) {
        return { kind: 'evasion', transforms: { separators: 0, repetitions: Math.max(1, literal.length - match.word.length), confusables: 0 } };
    }
    const folded = settings.normalization === 'standard' ? normalize(source, 'standard').text : literal;
    let folds = 0;
    for (let index = 0; index < Math.max(folded.length, literal.length); index++) if (folded[index] !== literal[index]) folds++;
    return folds ? { kind: 'leetspeak', folds } : NORMALIZED;
}

interface BadwordLocationLike { index: number; end: number }

/** Per-call, lazy access to the occurrences behind merged callback spans. */
export interface CensorDetail<Location extends { index: number; end: number }> {
    /** Occurrences inside a span passed to this call's callback, exactly as find() reports them. Scans once, on first use. */
    occurrences(span: { readonly index: number; readonly end: number }): readonly Location[];
}
export function censorDetail<Location extends { index: number; end: number }>(load: () => readonly Location[]): CensorDetail<Location> {
    let all: readonly Location[] | undefined;
    return Object.freeze({
        occurrences(span: { readonly index: number; readonly end: number }) {
            all ??= load();
            // Locations are ordered by start, so binary-search the first candidate.
            let low = 0, high = all.length;
            while (low < high) { const middle = (low + high) >> 1; if (all[middle].index < span.index) low = middle + 1; else high = middle; }
            const inside: Location[] = [];
            for (let at = low; at < all.length && all[at].index < span.end; at++) if (all[at].end <= span.end) inside.push(all[at]);
            return Object.freeze(inside);
        }
    });
}
