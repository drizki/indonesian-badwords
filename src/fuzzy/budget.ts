import { KeyBudget } from '../core/budget.ts';
import type { EvasionPlan } from '../evasion/types.ts';
import type { FuzzyConfig } from './types.ts';
import type { FuzzyLimit } from './policy.ts';
import { deletionHashes, deletionMaterial, gramCounts, gramSize, indexUnits, powerTable, usesDeletions, workspaceCells } from './candidates.ts';

type Fail = (limit: FuzzyLimit, maximum: number, used: number) => never;
type Shared = 'input' | 'states' | 'steps' | 'compileStates' | 'dictionaryLength';

/** Raises the evasion plan's error when its limit is the tighter one, otherwise this policy's. */
export const boundedLimit = (plan: EvasionPlan | undefined, fail: Fail) =>
    (limit: Shared, own: number, other: number | undefined, used: number): void => {
        if (other !== undefined && other < own) { if (used > other) plan!.exceeded(limit, other, used); }
        else if (used > own) fail(limit, own, used);
    };

interface Footprint { length: number; deletions: number; grams: number }
/**
 * Tracks the quantities compileFuzzy() enforces (trie states, state cells, index postings) for a changing key set,
 * through the same helpers the compiler uses. Dictionary material is already bounded by checkDictionary(): a key is
 * never longer than its word.
 */
export class FuzzyBudget extends KeyBudget {
    readonly #prints = new Map<string, Footprint>();
    readonly #lengths = new Map<number, number>();
    #deletionMaterial = 0; #deletionPostings = 0; #gramPostings = 0;
    #powers = powerTable(8); #suffix = new Uint32Array(8);
    constructor(readonly config: FuzzyConfig, readonly plan: EvasionPlan | undefined, readonly fail: Fail) { super(); }
    protected override enter(key: string): void {
        const units = indexUnits(key, this.config);
        if (!units) return;
        const length = units.length;
        if (length + 2 > this.#powers.length) { this.#powers = powerTable(length * 2 + 2); this.#suffix = new Uint32Array(this.#powers.length); }
        const deletions = this.config.maxEdits === 1 ? deletionHashes(units, this.#powers, this.#suffix).size : 0;
        const print = { length, deletions, grams: gramCounts(units, gramSize(length, this.config)).size };
        this.#prints.set(key, print);
        this.#lengths.set(length, (this.#lengths.get(length) ?? 0) + 1);
        this.#deletionMaterial += deletionMaterial(length); this.#deletionPostings += print.deletions; this.#gramPostings += print.grams;
    }
    protected override leave(key: string): void {
        const print = this.#prints.get(key);
        if (!print) return;
        this.#prints.delete(key);
        const left = this.#lengths.get(print.length)! - 1;
        if (left) this.#lengths.set(print.length, left); else this.#lengths.delete(print.length);
        this.#deletionMaterial -= deletionMaterial(print.length); this.#deletionPostings -= print.deletions; this.#gramPostings -= print.grams;
    }
    protected verify(): void {
        const { config, plan } = this;
        const maximumStates = Math.min(config.maxCompileStates, plan?.maxCompileStates ?? Infinity);
        if (this.trie.states > maximumStates) boundedLimit(plan, this.fail)('compileStates', config.maxCompileStates, plan?.maxCompileStates, maximumStates + 1);
        let maximum = 0;
        for (const length of this.#lengths.keys()) maximum = Math.max(maximum, length);
        const deletions = usesDeletions(config, maximum, this.#deletionMaterial);
        const cells = workspaceCells(config, maximum, this.#prints.size, deletions);
        if (cells > config.maxStateCells) this.fail('stateCells', config.maxStateCells, cells);
        if ((deletions ? this.#deletionPostings : this.#gramPostings) > config.maxIndexPostings)
            this.fail('indexPostings', config.maxIndexPostings, config.maxIndexPostings + 1);
    }
}
