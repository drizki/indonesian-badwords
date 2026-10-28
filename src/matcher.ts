import type { NormalizedText } from './normalize.ts';
import type { TrieLimit } from './evasion-types.ts';

export interface Entry { word: string; key: string; order: number }
export interface Match { word: string; start: number; end: number; order: number; from: number; to: number }
export interface CensorSpan { start: number; end: number; entries: Entry[] }
interface CensorCluster { start: number; end: number; entries: Set<Entry>; id: number }
interface Node { next: Map<number, number>; fail: number; output: number; entries: Entry[] }
export interface MatcherNode {
    readonly next: ReadonlyMap<number, number>;
    readonly entries: readonly Entry[];
    readonly fail: number;
    readonly output: number;
}
function node(): Node { return { next: new Map(), fail: 0, output: -1, entries: [] }; }
export function acceptsEnd(value: NormalizedText, to: number, wholeWords: boolean): boolean {
    return !(wholeWords && value.wordCharacters[to])
        && !(to < value.text.length && value.ends[to - 1] > value.starts[to]);
}
export function acceptsStart(value: NormalizedText, from: number, wholeWords: boolean): boolean {
    return !(from > 0 && value.ends[from - 1] > value.starts[from])
        && !(wholeWords && value.wordCharacters[from - 1]);
}

/** A cached Aho–Corasick automaton; suffix outputs use links instead of copies. */
export class Matcher {
    readonly #nodes: Node[] = [node()];

    constructor(entries: readonly Entry[], limit?: TrieLimit) {
        for (const entry of entries) {
            let state = 0;
            for (let index = 0; index < entry.key.length; index++) {
                const character = entry.key.charCodeAt(index);
                let next = this.#nodes[state].next.get(character);
                if (next === undefined) {
                    if (limit && this.#nodes.length >= limit.maximum) limit.exceeded(this.#nodes.length + 1);
                    next = this.#nodes.length;
                    this.#nodes[state].next.set(character, next);
                    this.#nodes.push(node());
                }
                state = next;
            }
            this.#nodes[state].entries.push(entry);
        }
        const queue = [...this.#nodes[0].next.values()];
        for (let head = 0; head < queue.length; head++) {
            const state = queue[head];
            for (const [character, next] of this.#nodes[state].next) {
                queue.push(next);
                let failure = this.#nodes[state].fail;
                while (failure && !this.#nodes[failure].next.has(character)) failure = this.#nodes[failure].fail;
                const fallback = this.#nodes[failure].next.get(character) ?? 0;
                this.#nodes[next].fail = fallback;
                this.#nodes[next].output = this.#nodes[fallback].entries.length
                    ? fallback : this.#nodes[fallback].output;
            }
        }
    }

    /** Enumerate every explicit term beginning at one native candidate position. */
    scanAt(text: string, start: number, visit: (entry: Entry, end: number) => boolean | void): boolean {
        let state = 0;
        for (let index = start; index < text.length; index++) {
            const next = this.#nodes[state].next.get(text.charCodeAt(index));
            if (next === undefined) break;
            state = next;
            for (const entry of this.#nodes[state].entries) {
                if (visit(entry, index + 1) === false) return false;
            }
        }
        return true;
    }
    view(): readonly MatcherNode[] { return this.#nodes; }

    /** Return false from a visitor to stop without allocating more occurrences. */
    scan(value: NormalizedText, wholeWords: boolean, visit: (match: Match) => boolean | void,
        spansOnly = false, eligibleEnd?: (end: number) => boolean,
        eligibleSpan?: (start: number, end: number) => boolean): void {
        let state = 0;
        for (let index = 0; index < value.text.length; index++) {
            const character = value.text.charCodeAt(index);
            while (state && !this.#nodes[state].next.has(character)) state = this.#nodes[state].fail;
            state = this.#nodes[state].next.get(character) ?? 0;
            if (eligibleEnd && !eligibleEnd(index + 1)) continue;
            // Every suffix shares this right edge; reject it once before
            // traversing potentially many suffix outputs on a benign token.
            if (!acceptsEnd(value, index + 1, wholeWords)) continue;
            let output = state;
            let covered = false;
            while (output !== -1) {
                for (const entry of this.#nodes[output].entries) {
                    const from = index + 1 - entry.key.length;
                    const to = index + 1;
                    // Reject partial source graphemes and compatibility expansions.
                    if (!acceptsStart(value, from, wholeWords)) continue;
                    if (eligibleSpan && !eligibleSpan(value.starts[from], value.ends[index])) continue;
                    if (visit({ word: entry.word, start: value.starts[from], end: value.ends[index],
                        order: entry.order, from, to }) === false) return;
                    // Outputs follow decreasing key length. For censorship the
                    // first valid span subsumes all other matches at this end.
                    if (spansOnly) { covered = true; break; }
                }
                if (covered) break;
                output = this.#nodes[output].output;
            }
        }
    }

    /** Merge coverage and contributors without allocating individual occurrences. */
    scanCensor(value: NormalizedText, wholeWords: boolean,
        eligibleSpan?: (start: number, end: number) => boolean): CensorSpan[] {
        const spans: CensorCluster[] = [];
        const pending: number[] = [];
        let complete: Uint32Array | undefined;
        let sequence = 0;
        let state = 0;
        for (let index = 0; index < value.text.length; index++) {
            const character = value.text.charCodeAt(index);
            while (state && !this.#nodes[state].next.has(character)) state = this.#nodes[state].fail;
            state = this.#nodes[state].next.get(character) ?? 0;
            const to = index + 1;
            if (!acceptsEnd(value, to, wholeWords)) continue;
            let output = state;
            let span: CensorCluster | undefined;
            pending.length = 0;
            while (output !== -1) {
                if (span && complete![output] === span.id) break;
                for (const entry of this.#nodes[output].entries) {
                    if (span && span.entries.has(entry)) continue;
                    const from = to - entry.key.length;
                    if (!acceptsStart(value, from, wholeWords)) continue;
                    if (eligibleSpan && !eligibleSpan(value.starts[from], value.ends[index])) continue;
                    if (!span) {
                        complete ??= new Uint32Array(this.#nodes.length);
                        const start = value.starts[from];
                        const end = value.ends[index];
                        const previous = spans[spans.length - 1];
                        if (previous && start < previous.end) {
                            span = previous;
                            span.start = Math.min(start, span.start);
                            span.end = end;
                            // A later, longer occurrence can bridge several
                            // formerly separate clusters. Preserve every word.
                            while (spans.length > 1 && span.start < spans[spans.length - 2].end) {
                                spans.pop();
                                const older = spans.pop()!;
                                const start = Math.min(span.start, older.start);
                                const end = span.end;
                                // Keep the larger contributor set and its ID:
                                // repeated bridges must not copy a large prefix
                                // into each tiny new cluster. Its completed
                                // suffix chains stay valid as membership grows.
                                const larger: CensorCluster = span.entries.size >= older.entries.size ? span : older;
                                const smaller: CensorCluster = larger === span ? older : span;
                                for (const contributor of smaller.entries) larger.entries.add(contributor);
                                span = larger;
                                span.start = start;
                                span.end = end;
                                spans.push(span);
                            }
                        } else {
                            span = { start, end, entries: new Set(), id: ++sequence };
                            spans.push(span);
                        }
                    }
                    span.entries.add(entry);
                    if (complete![output] === span.id) break;
                }
                if (span && complete![output] === span.id) break;
                pending.push(output);
                output = this.#nodes[output].output;
            }
            if (!span) continue;
            // A completed suffix chain only contains words already contributed
            // to this cluster. Revisiting it cannot change coverage or metadata.
            let finished = output === -1 || complete![output] === span.id;
            for (let item = pending.length - 1; item >= 0 && finished; item--) {
                const current = pending[item];
                for (const entry of this.#nodes[current].entries) {
                    if (!span.entries.has(entry)) { finished = false; break; }
                }
                if (finished) complete![current] = span.id;
            }
        }
        return spans.map(({ start, end, entries }) => ({ start, end, entries: [...entries] }));
    }
}
