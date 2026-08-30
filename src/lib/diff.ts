/**
 * Text & Code Diff Engine
 * Computes token-level and line-level diffs with red/green distinctions
 * for comparing original replies vs regenerated preset replies.
 */

export type DiffType = 'added' | 'removed' | 'unchanged';

export interface DiffChunk {
  type: DiffType;
  value: string;
}

export interface DiffLine {
  type: DiffType;
  prefix: '-' | '+' | ' ';
  text: string;
  originalLineNumber?: number;
  modifiedLineNumber?: number;
}

export interface DiffStats {
  additions: number;
  deletions: number;
  unchanged: number;
}

/**
 * Tokenize string preserving Chinese characters, English words, punctuation and whitespaces
 */
function tokenize(text: string): string[] {
  if (!text) return [];
  // Match Chinese characters individually, words, whitespace sequences, and individual punctuation
  const matches = text.match(/[\u4e00-\u9fa5]|[a-zA-Z0-9_]+|[^\s\w\u4e00-\u9fa5]|\s+/g);
  return matches || [text];
}

/**
 * Compute token-level inline diff between original and modified text
 */
export function computeTextDiff(original: string, modified: string): DiffChunk[] {
  if (original === modified) {
    return [{ type: 'unchanged', value: original || '' }];
  }
  if (!original) {
    return [{ type: 'added', value: modified || '' }];
  }
  if (!modified) {
    return [{ type: 'removed', value: original || '' }];
  }

  const a = tokenize(original);
  const b = tokenize(modified);

  // 1. Fast path: strip common prefix
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    start++;
  }

  // 2. Fast path: strip common suffix
  let aEnd = a.length - 1;
  let bEnd = b.length - 1;
  while (aEnd >= start && bEnd >= start && a[aEnd] === b[bEnd]) {
    aEnd--;
    bEnd--;
  }

  const prefixChunks: DiffChunk[] =
    start > 0 ? [{ type: 'unchanged', value: a.slice(0, start).join('') }] : [];
  const suffixChunks: DiffChunk[] =
    aEnd < a.length - 1 ? [{ type: 'unchanged', value: a.slice(aEnd + 1).join('') }] : [];

  const midA = a.slice(start, aEnd + 1);
  const midB = b.slice(start, bEnd + 1);

  let midChunks: DiffChunk[] = [];

  if (midA.length === 0 && midB.length > 0) {
    midChunks = [{ type: 'added', value: midB.join('') }];
  } else if (midA.length > 0 && midB.length === 0) {
    midChunks = [{ type: 'removed', value: midA.join('') }];
  } else if (midA.length > 0 && midB.length > 0) {
    const n = midA.length;
    const m = midB.length;

    // Safety threshold: if tokens are huge, fall back to sentence/chunk diff to prevent memory spikes
    if (n * m > 400000) {
      midChunks = [
        { type: 'removed', value: midA.join('') },
        { type: 'added', value: midB.join('') },
      ];
    } else {
      // DP Table for Longest Common Subsequence (LCS)
      const dp: number[][] = Array.from({ length: n + 1 }, () => new Int32Array(m + 1) as unknown as number[]);

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < m; j++) {
          if (midA[i] === midB[j]) {
            dp[i + 1][j + 1] = dp[i][j] + 1;
          } else {
            dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1]);
          }
        }
      }

      // Backtrack to extract diff sequence
      let i = n;
      let j = m;
      const rawChunks: { type: DiffType; value: string }[] = [];

      while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && midA[i - 1] === midB[j - 1]) {
          rawChunks.unshift({ type: 'unchanged', value: midA[i - 1] });
          i--;
          j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
          rawChunks.unshift({ type: 'added', value: midB[j - 1] });
          j--;
        } else if (i > 0 && (j === 0 || dp[i][j - 1] < dp[i - 1][j])) {
          rawChunks.unshift({ type: 'removed', value: midA[i - 1] });
          i--;
        }
      }

      // Merge contiguous chunks of same type
      for (const item of rawChunks) {
        if (midChunks.length > 0 && midChunks[midChunks.length - 1].type === item.type) {
          midChunks[midChunks.length - 1].value += item.value;
        } else {
          midChunks.push({ type: item.type, value: item.value });
        }
      }
    }
  }

  // Final merge
  const all: DiffChunk[] = [];
  for (const chunk of [...prefixChunks, ...midChunks, ...suffixChunks]) {
    if (!chunk.value) continue;
    if (all.length > 0 && all[all.length - 1].type === chunk.type) {
      all[all.length - 1].value += chunk.value;
    } else {
      all.push({ ...chunk });
    }
  }

  return all;
}

/**
 * Calculate statistical character count for additions & deletions
 */
export function getDiffStats(chunks: DiffChunk[]): DiffStats {
  let additions = 0;
  let deletions = 0;
  let unchanged = 0;

  for (const chunk of chunks) {
    const len = chunk.value.length;
    if (chunk.type === 'added') {
      additions += len;
    } else if (chunk.type === 'removed') {
      deletions += len;
    } else {
      unchanged += len;
    }
  }

  return { additions, deletions, unchanged };
}

/**
 * Compute line-by-line diff format for code-like view
 */
export function computeLineDiff(original: string, modified: string): DiffLine[] {
  const origLines = (original || '').split('\n');
  const modLines = (modified || '').split('\n');

  const lines: DiffLine[] = [];
  let oIdx = 0;
  let mIdx = 0;

  while (oIdx < origLines.length || mIdx < modLines.length) {
    const oLine = origLines[oIdx];
    const mLine = modLines[mIdx];

    if (oIdx < origLines.length && mIdx < modLines.length && oLine === mLine) {
      lines.push({
        type: 'unchanged',
        prefix: ' ',
        text: oLine,
        originalLineNumber: oIdx + 1,
        modifiedLineNumber: mIdx + 1,
      });
      oIdx++;
      mIdx++;
    } else {
      // If lines differ
      if (oIdx < origLines.length) {
        lines.push({
          type: 'removed',
          prefix: '-',
          text: oLine,
          originalLineNumber: oIdx + 1,
        });
        oIdx++;
      }
      if (mIdx < modLines.length) {
        lines.push({
          type: 'added',
          prefix: '+',
          text: mLine,
          modifiedLineNumber: mIdx + 1,
        });
        mIdx++;
      }
    }
  }

  return lines;
}
