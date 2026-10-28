import type { MatchAcceptance } from '../core/exceptions.ts';
import type { Entry, Match, Matcher } from '../core/matcher.ts';
import { canonicalSearchView, caseWidthStable, foldCandidateText, previousCodePoint,
    sourceBoundaryChecker, wordAt } from './normalize.ts';
import { canonicalCandidatePattern, type NativePatterns } from '../core/pattern.ts';

/** Bounded candidate patterns share the same lazily compiled dictionary automaton. */
export class UnicodeMatcher {
    #literal: RegExp | null | undefined;
    #aliases: RegExp | null | undefined;
    #complex: RegExp | null | undefined;

    constructor(readonly patterns: NativePatterns, readonly matcher: () => Matcher) {}

    search(source: string): 'clean' | UnicodeView | undefined {
        if (this.#literal === undefined) this.#literal = canonicalCandidatePattern(this.patterns, false, true) ?? null;
        const literal = this.#literal;
        if (!literal) return;
        const canonical = canonicalSearchView(source);
        if (this.patterns.complex) {
            if (this.#complex === undefined) this.#complex = canonicalCandidatePattern(
                { simple: '', complex: this.patterns.complex }, true) ?? null;
            // Multipart occurrences retain the end-ordered scanner's coverage
            // and completed-contributor aggregation, including dense prefixes.
            if (!this.#complex || this.#complex.test(canonical.text)) return;
        }
        const value = foldCandidateText(canonical.text);
        if (value === undefined) {
            if (this.#aliases === undefined) this.#aliases = canonicalCandidatePattern(this.patterns, true) ?? null;
            return this.#aliases && !this.#aliases.test(canonical.text) ? 'clean' : undefined;
        }
        literal.lastIndex = 0;
        const first = literal.exec(value);
        // Composition cannot introduce ASCII keys; source/word edges only
        // remove occurrences from this unbounded candidate search.
        if (!first) return 'clean';
        // Only unchanged canonical source atoms with width-preserving case
        // and folding can reuse UTF-16 offsets. Original grapheme edges remain
        // authoritative at each candidate; unsupported inputs keep source maps.
        if (!canonical.identity || value.length !== source.length || !caseWidthStable(source)
            || value.normalize('NFKC') !== value) return;
        return new UnicodeView(source, value, literal, first, this.matcher);
    }
}

/** A per-operation view; no source text is retained by the dictionary cache. */
export class UnicodeView {
    constructor(readonly source: string, readonly value: string, readonly literal: RegExp,
        readonly first: RegExpExecArray, readonly matcher: () => Matcher) {}

    #walk(visit: (entry: Entry, start: number, end: number) => boolean | void,
        accept?: MatchAcceptance): void {
        const boundary = sourceBoundaryChecker(this.source);
        this.literal.lastIndex = this.first.index + 1;
        for (let hit: RegExpExecArray | null = this.first; hit !== null; hit = this.literal.exec(this.value)) {
            const start = hit.index;
            // Visit overlapping starts and every terminal at the same start,
            // even when the regex chose a shorter dictionary alternative.
            this.literal.lastIndex = start + 1;
            if (wordAt(this.value, previousCodePoint(this.value, start)) || !boundary(start)) continue;
            if (this.matcher().scanAt(this.value, start, (entry, end) => {
                if (wordAt(this.value, end) || !boundary(end) || (accept && !accept(start, end))) return;
                return visit(entry, start, end);
            }) === false) return;
        }
    }

    scan(visit: (match: Match) => boolean | void, accept?: MatchAcceptance): void {
        this.#walk(({ word, order }, start, end) => visit({ word, order, start, end, from: start, to: end }), accept);
    }

}
