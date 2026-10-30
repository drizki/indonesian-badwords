import type { Match } from './matcher.ts';

/** What find() and analyze() do when the occurrences exceed maxMatches. */
export type MaxMatchesMode = 'throw' | 'truncate';

export function maxMatchesMode(value: unknown): MaxMatchesMode | undefined {
    if (value !== undefined && value !== 'throw' && value !== 'truncate') {
        throw new TypeError("onMaxMatches must be 'throw' or 'truncate'");
    }
    return value;
}

const LINE_BREAKS = /\r\n|[\n\r\u2028\u2029]/g;
/**
 * Collapse every whitespace run to one space and trim. With keepBreaks, a run that contains
 * line breaks collapses to exactly those breaks (CRLF stays one unit; other whitespace in the
 * run, including indentation and trailing spaces, is dropped).
 */
export function collapseWhitespace(text: string, keepBreaks: boolean): string {
    if (!keepBreaks) return text.replace(/\s+/gu, ' ').trim();
    return text.replace(/\s+/gu, (run) => run.match(LINE_BREAKS)?.join('') ?? ' ').trim();
}

export const bySource = (a: Match, b: Match): number => a.start - b.start || a.order - b.order || a.end - b.end;

/**
 * Collects occurrences up to a limit. 'throw' fails on the first occurrence past the limit.
 * 'truncate' keeps the first `limit` in source order (start, then dictionary order, then end)
 * of ALL occurrences, although scanners emit by end position: it buffers at most 2 * limit and
 * sorts down to `limit` whenever the buffer fills, so memory stays bounded. Scanners that can bound
 * where later occurrences start (see ordered() and frontier()) let it say when to stop scanning.
 */
export class MatchWindow {
    readonly matches: Match[] = [];
    truncated = false;
    readonly truncating: boolean;
    #done = false;
    #inOrder = false;
    #cutoff: Match | undefined;
    #starts: ArrayLike<number> | undefined;
    #reach = 0;
    constructor(private readonly limit: number, truncate: boolean) { this.truncating = truncate; }
    /** The scanner emits occurrences with strictly increasing start offsets (the native word pattern). */
    ordered(): void { this.#inOrder = true; }
    /**
     * The scanner emits by end position over normalized text, no occurrence is longer than `reach` characters, and
     * starts[i] is the source offset of normalized character i (never decreasing). An occurrence emitted later then
     * starts at or after starts[end - reach] of the one just emitted.
     */
    frontier(starts: ArrayLike<number>, reach: number): void { this.#starts = starts; this.#reach = reach; }
    /** Returns false once no later occurrence can be among the first `limit`, so the scanner may stop. */
    add(match: Match): boolean {
        const { matches, limit } = this;
        if (!this.truncating) {
            if (matches.length >= limit) {
                throw new RangeError("Match limit exceeded; increase maxMatches, set onMaxMatches: 'truncate', or use flag(), badwords(), or censor()");
            }
            matches.push(match);
            return true;
        }
        if (this.#done) return false;
        matches.push(match);
        if (this.#inOrder) {
            if (matches.length <= limit) return true;
            matches.length = limit;
            this.truncated = this.#done = true;
            return false;
        }
        if (matches.length >= 2 * limit) this.#cut();
        // Every later occurrence starts after the kept limit-th one, so none can displace it.
        if (this.#cutoff && this.#starts && this.#starts[Math.max(0, match.to - this.#reach)] > this.#cutoff.start) this.#done = true;
        return !this.#done;
    }
    #cut(): void {
        this.matches.sort(bySource);
        this.matches.length = this.limit;
        this.#cutoff = this.matches[this.limit - 1];
        this.truncated = true;
    }
    /** The kept matches in source order. */
    finish(): Match[] {
        const { matches } = this;
        matches.sort(bySource);
        if (matches.length > this.limit) { matches.length = this.limit; this.truncated = true; }
        return matches;
    }
}
