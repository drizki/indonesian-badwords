import { Badwords, type AnalysisResult, type BadwordLocation } from 'indonesian-badwords';
import { boundedFuzzy } from 'indonesian-badwords/fuzzy';

export const initialMessage = '👩🏽‍💻 g0bl0k! Baju Bodo';
export interface Segment { text: string; matched: boolean }
export type View =
  | { status: 'complete'; text: string; result: AnalysisResult; segments: Segment[] }
  | { status: 'error'; error: string };

// Merge overlap for presentation only. Detection and exceptions stay in the library.
export function segments(text: string, locations: readonly BadwordLocation[]): Segment[] {
  const ranges: Array<{ index: number; end: number }> = [];
  for (const hit of locations) {
    const previous = ranges.at(-1);
    if (previous && hit.index < previous.end) previous.end = Math.max(previous.end, hit.end);
    else ranges.push({ index: hit.index, end: hit.end });
  }
  const result: Segment[] = [];
  let offset = 0;
  for (const range of ranges) {
    result.push({ text: text.slice(offset, range.index), matched: false });
    result.push({ text: text.slice(range.index, range.end), matched: true });
    offset = range.end;
  }
  result.push({ text: text.slice(offset), matched: false });
  return result;
}

export function createModerator(extraWords: readonly string[] = []) {
  // One compiled policy per app/component instance, reused on input updates.
  const checker = new Badwords({
    allowPhrases: ['Baju Bodo'],
    fuzzy: boundedFuzzy({ model: 'osa', limits: { maxInputLength: 1000 } }),
  });
  checker.addWords(extraWords);
  return {
    check(message: string, quote = ''): View {
      const text = quote ? `${quote}\n${message}` : message;
      try {
        const result = checker.analyze(text, {
          ignoreRanges: quote ? [{ index: 0, end: quote.length + 1 }] : [],
        });
        return { status: 'complete', text, result, segments: segments(text, result.locations) };
      } catch (error) {
        // Never turn an incomplete check into a clean verdict.
        return { status: 'error', error: error instanceof Error ? error.message : 'Check failed' };
      }
    },
  };
}
