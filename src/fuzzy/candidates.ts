import type { Entry } from '../core/matcher.ts';
import type { FuzzyConfig } from './types.ts';
export interface FuzzyMeter { tick(count?: number): void; candidate(): void; cells(used: number): void }
export interface FuzzyGroup { units: readonly number[]; entries: Entry[]; composed: boolean; masks?: Map<number, number>; top: number }
interface Bucket { q: number; threshold: number; ids: number[]; keys: Map<number, number>; starts: Uint32Array; values: Uint32Array }
export type IndexFail = (limit: 'indexPostings' | 'stateCells', maximum: number, used: number) => never;
function hash(units: readonly number[], at: number, q: number): number {
    let value = 2166136261;
    for (let j = 0; j < q; j++) value = Math.imul(value ^ units[at + j], 16777619);
    return value >>> 0;
}
/** Reusable numeric query counts. No source strings or per-token Maps are retained. */
class Grams {
    hashes: Uint32Array; counts: Uint32Array; stamps: Uint32Array; touched: Uint32Array;
    size = 0; epoch = 0;
    constructor(capacity: number) {
        this.hashes = new Uint32Array(capacity); this.counts = new Uint32Array(capacity);
        this.stamps = new Uint32Array(capacity); this.touched = new Uint32Array(capacity);
    }
    count(units: readonly number[], q: number, meter: FuzzyMeter): void {
        this.size = 0;
        if (++this.epoch > 0xffff_ffff) { this.stamps.fill(0); this.epoch = 1; }
        for (let i = 0; i + q <= units.length; i++) {
            meter.tick(); const value = hash(units, i, q); let at = value & (this.hashes.length - 1);
            while (this.stamps[at] === this.epoch && this.hashes[at] !== value) { meter.tick(); at = (at + 1) & (this.hashes.length - 1); }
            if (this.stamps[at] !== this.epoch) {
                this.stamps[at] = this.epoch; this.hashes[at] = value; this.counts[at] = 0; this.touched[this.size++] = at;
            }
            this.counts[at]++;
        }
    }
}
export class FuzzyIndex {
    readonly groups: FuzzyGroup[] = [];
    readonly maximum: number;
    readonly workspaceCells: number;
    readonly minimum: number;
    readonly #buckets = new Map<number, Bucket>();
    readonly #scores: Uint32Array; readonly #stamps: Uint32Array; readonly #touched: Uint32Array;
    #epoch = 0;
    readonly #grams: Grams[];
    readonly #rows: Uint32Array[];
    readonly #deletions?: Map<string, Uint32Array>;
    constructor(entries: readonly Entry[], readonly config: FuzzyConfig, composed: (key: string) => boolean, fail: IndexFail) {
        const grouped = new Map<string, FuzzyGroup>();
        for (const entry of entries) {
            if (!/^[\p{L}\p{N}\p{M}]+$/u.test(entry.key) || !/\p{L}/u.test(entry.key)) continue;
            const units = Array.from(entry.key, character => character.codePointAt(0)!);
            if (units.length < config.minLength || units.length > config.maxLength) continue;
            let group = grouped.get(entry.key);
            if (!group) {
                group = { units, entries: [], composed: composed(entry.key), top: 1 << (units.length - 1) };
                if (config.model === 'levenshtein' && config.insertions && config.deletions && config.substitutions && units.length <= 32) {
                    group.masks = new Map();
                    for (let i = 0; i < units.length; i++) group.masks.set(units[i], (group.masks.get(units[i]) ?? 0) | (1 << i));
                }
                grouped.set(entry.key, group);
            }
            group.entries.push(entry);
        }
        this.groups = [...grouped.values()];
        this.maximum = this.groups.reduce((n, group) => Math.max(n, group.units.length), 0);
        this.minimum = this.groups.reduce((n, group) => Math.min(n, group.units.length), Infinity);
        // One-edit deletion signatures are cheaper for compact lexicons. Bound
        // their total string material; larger profiles use packed q-grams.
        const useDeletions = config.maxEdits === 1 && this.maximum <= 64
            && this.groups.reduce((n, group) => n + 2 * group.units.length * (group.units.length + 1), 0) <= 131_072;
        let capacity = 1;
        if (!useDeletions) while (capacity < (this.maximum + config.maxEdits + 1) * 2) capacity *= 2;
        const cells = capacity * 12 + (this.maximum + config.maxEdits + 1) * 3 + this.groups.length * 3;
        if (cells > config.maxStateCells) fail('stateCells', config.maxStateCells, cells);
        this.workspaceCells = cells;
        this.#scores = new Uint32Array(this.groups.length); this.#stamps = new Uint32Array(this.groups.length); this.#touched = new Uint32Array(this.groups.length);
        this.#grams = useDeletions ? [] : [new Grams(capacity), new Grams(capacity), new Grams(capacity)];
        this.#rows = Array.from({ length: 3 }, () => new Uint32Array(this.maximum + config.maxEdits + 1));
        if (useDeletions) {
            const lists = new Map<string, number[]>(); let postings = 0;
            this.groups.forEach((group, id) => {
                const key = group.entries[0].key, signatures = new Set([key]); let at = 0;
                for (const character of key) { signatures.add(key.slice(0, at) + key.slice(at + character.length)); at += character.length; }
                for (const signature of signatures) {
                    if (++postings > config.maxIndexPostings) fail('indexPostings', config.maxIndexPostings, postings);
                    const ids = lists.get(signature) ?? []; ids.push(id); lists.set(signature, ids);
                }
            });
            this.#deletions = new Map([...lists].map(([key, ids]) => [key, Uint32Array.from(ids)]));
            return;
        }
        const lengths = new Map<number, number[]>();
        this.groups.forEach((group, id) => { const list = lengths.get(group.units.length) ?? []; list.push(id); lengths.set(group.units.length, list); });
        let postings = 0;
        for (const [length, ids] of lengths) {
            const q = Math.max(1, Math.min(3, Math.floor((length - (config.model === 'osa' ? config.maxEdits : 0)) / (config.maxEdits + 1))));
            const threshold = length - q + 1 - config.maxEdits * (q === 1 ? 1 : q + Number(config.model === 'osa'));
            const lists = new Map<number, number[]>();
            for (const id of ids) {
                const counts = new Map<number, number>(), units = this.groups[id].units;
                for (let i = 0; i + q <= units.length; i++) { const gram = hash(units, i, q); counts.set(gram, (counts.get(gram) ?? 0) + 1); }
                for (const [gram, count] of counts) {
                    if (++postings > config.maxIndexPostings) fail('indexPostings', config.maxIndexPostings, postings);
                    const list = lists.get(gram) ?? []; list.push(id, count); lists.set(gram, list);
                }
            }
            const keys = new Map<number, number>(), starts = new Uint32Array(lists.size + 1), values = new Uint32Array([...lists.values()].reduce((n, list) => n + list.length, 0));
            let index = 0, offset = 0;
            for (const [gram, list] of lists) { keys.set(gram, index); starts[index++] = offset; values.set(list, offset); offset += list.length; }
            starts[index] = offset; this.#buckets.set(length, { q, threshold, ids, keys, starts, values });
        }
    }
    #verify(group: FuzzyGroup, query: readonly number[], meter: FuzzyMeter): boolean {
        meter.candidate();
        const config = this.config, k = config.maxEdits;
        if (group.masks) {
            let positive = -1, negative = 0, score = group.units.length;
            for (const code of query) {
                meter.tick(); const eq = group.masks.get(code) ?? 0, vertical = eq | negative;
                const horizontal = (((eq & positive) + positive) ^ positive) | eq;
                let plus = negative | ~(horizontal | positive), minus = positive & horizontal;
                if (plus & group.top) score++; if (minus & group.top) score--;
                plus = (plus << 1) | 1; minus <<= 1; positive = minus | ~(vertical | plus); negative = plus & vertical;
            }
            return score <= k;
        }
        const a = group.units, inf = k + 1, ins = config.insertions ? 1 : inf, del = config.deletions ? 1 : inf, sub = config.substitutions ? 1 : inf;
        let [older, previous, next] = this.#rows, previousMinimum = 0;
        meter.tick((query.length + 1) * 2);
        older.fill(inf, 0, query.length + 1); previous.fill(inf, 0, query.length + 1); previous[0] = 0;
        for (let j = 1; j <= Math.min(k, query.length); j++) previous[j] = Math.min(inf, previous[j - 1] + ins);
        for (let i = 1; i <= a.length; i++) {
            next.fill(inf, Math.max(0, i - k - 1), Math.min(query.length + 1, i + k + 2)); next[0] = Math.min(inf, i * del); let minimum = next[0];
            for (let j = Math.max(1, i - k); j <= Math.min(query.length, i + k); j++) {
                meter.tick(); let value = Math.min(inf, previous[j] + del, next[j - 1] + ins, previous[j - 1] + (a[i - 1] === query[j - 1] ? 0 : sub));
                if (config.model === 'osa' && i > 1 && j > 1 && a[i - 1] === query[j - 2] && a[i - 2] === query[j - 1]) value = Math.min(value, older[j - 2] + 1);
                next[j] = value; minimum = Math.min(minimum, value);
            }
            // A pending OSA swap may recover from a high intermediate row.
            if (minimum > k && (config.model !== 'osa' || previousMinimum >= k)) return false;
            previousMinimum = minimum; [older, previous, next] = [previous, next, older];
        }
        return previous[query.length] <= k;
    }
    query(query: readonly number[], meter: FuzzyMeter, visit: (group: FuzzyGroup) => boolean | void, transformed = false): boolean {
        if (!query.length || query.length < this.minimum - this.config.maxEdits || query.length > this.maximum + this.config.maxEdits) return true;
        if (++this.#epoch > 0xffff_ffff) { this.#stamps.fill(0); this.#epoch = 1; }
        if (this.#deletions) {
            // Any one-edit alignment, including an adjacent OSA swap, shares
            // a subsequence obtained by deleting at most one scalar per side.
            const check = (signature: string): boolean => {
                for (const id of this.#deletions!.get(signature) ?? []) {
                    meter.tick(); if (this.#stamps[id] === this.#epoch) continue; this.#stamps[id] = this.#epoch;
                    const group = this.groups[id];
                    if ((!transformed || group.composed) && Math.abs(group.units.length - query.length) <= 1
                        && this.#verify(group, query, meter) && visit(group) === false) return false;
                }
                return true;
            };
            meter.tick(query.length);
            const spelling = query.map(code => String.fromCodePoint(code)).join('');
            if (!check(spelling)) return false;
            let offset = 0;
            for (const code of query) {
                meter.tick(query.length); const width = code > 0xffff ? 2 : 1;
                if (!check(spelling.slice(0, offset) + spelling.slice(offset + width))) return false;
                offset += width;
            }
            return true;
        }
        let size = 0, counted = 0;
        const verify = (id: number) => {
            const group = this.groups[id];
            return (!transformed || group.composed) && this.#verify(group, query, meter) && visit(group) === false;
        };
        for (let length = Math.max(1, query.length - this.config.maxEdits); length <= query.length + this.config.maxEdits; length++) {
            const bucket = this.#buckets.get(length); if (!bucket) continue;
            if (bucket.threshold <= 0) { for (const id of bucket.ids) { meter.tick(); if (verify(id)) return false; } continue; }
            const grams = this.#grams[bucket.q - 1];
            if (!(counted & (1 << bucket.q))) { grams.count(query, bucket.q, meter); counted |= 1 << bucket.q; }
            for (let i = 0; i < grams.size; i++) {
                const at = grams.touched[i], group = bucket.keys.get(grams.hashes[at]); if (group === undefined) continue;
                for (let p: number = bucket.starts[group]; p < bucket.starts[group + 1]; p += 2) {
                    meter.tick(); const id = bucket.values[p];
                    if (this.#stamps[id] !== this.#epoch) { this.#stamps[id] = this.#epoch; this.#scores[id] = 0; this.#touched[size++] = id; }
                    // Hash collisions only increase overlap estimates; full verification is mandatory.
                    this.#scores[id] += Math.min(grams.counts[at], bucket.values[p + 1]);
                }
            }
        }
        for (let i = 0; i < size; i++) {
            meter.tick(); const id = this.#touched[i];
            if (this.#scores[id] >= this.#buckets.get(this.groups[id].units.length)!.threshold && verify(id)) return false;
        }
        return true;
    }
}
