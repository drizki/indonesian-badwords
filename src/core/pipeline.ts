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
 * sorts down to `limit` whenever the buffer fills, so memory stays bounded.
 */
export class MatchWindow {
    readonly matches: Match[] = [];
    truncated = false;
    constructor(private readonly limit: number, private readonly truncate: boolean) {}
    add(match: Match): void {
        const { matches, limit } = this;
        if (!this.truncate) {
            if (matches.length >= limit) {
                throw new RangeError("Match limit exceeded; increase maxMatches, set onMaxMatches: 'truncate', or use flag(), badwords(), or censor()");
            }
            matches.push(match);
        } else if (matches.push(match) >= 2 * limit) this.cut();
    }
    private cut(): void {
        this.matches.sort(bySource);
        this.matches.length = this.limit;
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
