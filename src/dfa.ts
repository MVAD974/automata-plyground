import { BaseAutomaton } from './fa';
import type { Transition } from './fa';

export class DFA extends BaseAutomaton {
  static fromDefinition(definition: string): DFA {
    // Parse the definition string into DFA components
    const lines = definition.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const states = lines.find(l => l.startsWith('states:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
    const alphabet = lines.find(l => l.startsWith('alphabet:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
    const start = lines.find(l => l.startsWith('start:'))?.split(':')[1]?.trim() || '';
    const accept = lines.find(l => l.startsWith('accept:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
    const transitions: Transition[] = [];
    let inTrans = false;
    for (const l of lines) {
      if (l.startsWith('transitions:')) { inTrans = true; continue; }
      if (inTrans && l.includes('->')) {
        const [left, to] = l.split('->').map(s => s.trim());
        const [from, symbol] = left.split(',').map(s => s.trim());
        transitions.push({ from, symbol, to });
      }
    }
    return new DFA(states, alphabet, start, accept, transitions);
  }

  runWord(word: string): boolean {
    let current = this.start;
    for (const symbol of word) {
      const t = this.transitions.find(tr => tr.from === current && tr.symbol === symbol);
      if (!t) return false;
      current = t.to;
    }
    return this.accept.includes(current);
  }

  // Set operations and language properties
  // Note: These are simplified for classic DFA with string state names and transitions array

  // Returns true if the language accepted by this DFA is a subset of that of other
  issubset(other: DFA): boolean {
    // Both DFAs must have the same alphabet
    if (this.alphabet.length !== other.alphabet.length || !this.alphabet.every(a => other.alphabet.includes(a))) {
      throw new Error('Alphabets must match for subset check');
    }
    // Cross-product construction: look for a state where this is final and other is not
    const queue: Array<[string, string]> = [[this.start, other.start]];
    const visited = new Set<string>();
    while (queue.length) {
      const [s1, s2] = queue.shift()!;
      const key = `${s1},${s2}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (this.accept.includes(s1) && !other.accept.includes(s2)) return false;
      for (const symbol of this.alphabet) {
        const t1 = this.transitions.find(t => t.from === s1 && t.symbol === symbol);
        const t2 = other.transitions.find(t => t.from === s2 && t.symbol === symbol);
        if (t1 && t2) queue.push([t1.to, t2.to]);
      }
    }
    return true;
  }

  issuperset(other: DFA): boolean {
    return other.issubset(this);
  }

  isdisjoint(other: DFA): boolean {
    // Cross-product: look for a state where both are final
    const queue: Array<[string, string]> = [[this.start, other.start]];
    const visited = new Set<string>();
    while (queue.length) {
      const [s1, s2] = queue.shift()!;
      const key = `${s1},${s2}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (this.accept.includes(s1) && other.accept.includes(s2)) return false;
      for (const symbol of this.alphabet) {
        const t1 = this.transitions.find(t => t.from === s1 && t.symbol === symbol);
        const t2 = other.transitions.find(t => t.from === s2 && t.symbol === symbol);
        if (t1 && t2) queue.push([t1.to, t2.to]);
      }
    }
    return true;
  }

  isempty(): boolean {
    // BFS from start, see if any accept state is reachable
    const queue = [this.start];
    const visited = new Set<string>();
    while (queue.length) {
      const state = queue.shift()!;
      if (visited.has(state)) continue;
      visited.add(state);
      if (this.accept.includes(state)) return false;
      for (const t of this.transitions) {
        if (t.from === state && !visited.has(t.to)) {
          queue.push(t.to);
        }
      }
    }
    return true;
  }

  // Returns true if the language accepted by this DFA is finite
  isfinite(): boolean {
    // Detect cycles reachable from start and leading to accept
    const visited = new Set<string>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    let foundCycle = false;
    const dfs = (state: string) => {
      if (foundCycle) return;
      visited.add(state);
      stack.push(state);
      onStack.add(state);
      for (const t of this.transitions.filter(tr => tr.from === state)) {
        if (!visited.has(t.to)) {
          dfs(t.to);
        } else if (onStack.has(t.to)) {
          // Found a cycle
          if (this.accept.includes(t.to)) foundCycle = true;
        }
      }
      stack.pop();
      onStack.delete(state);
    };
    dfs(this.start);
    return !foundCycle;
  }

  // Returns a random word of length k accepted by this DFA (if any)
  randomWord(k: number): string | null {
    // Brute-force: enumerate all words of length k, pick one at random
    const words = Array.from(this.wordsOfLength(k));
    if (words.length === 0) return null;
    const idx = Math.floor(Math.random() * words.length);
    return words[idx];
  }

  // Generator for all words of length k accepted by this DFA
  *wordsOfLength(k: number): Generator<string, void, unknown> {
    // BFS: (state, wordSoFar, length)
    const queue: Array<{ state: string; word: string; len: number }> = [
      { state: this.start, word: '', len: 0 },
    ];
    while (queue.length) {
      const { state, word, len } = queue.shift()!;
      if (len === k) {
        if (this.accept.includes(state)) yield word;
        continue;
      }
      for (const symbol of this.alphabet) {
        const t = this.transitions.find(tr => tr.from === state && tr.symbol === symbol);
        if (t) queue.push({ state: t.to, word: word + symbol, len: len + 1 });
      }
    }
  }

  // Returns the cardinality of the language (number of accepted words, if finite)
  cardinality(): number | null {
    // If infinite, return null
    if (!this.isfinite()) return null;
    let total = 0;
    for (let k = 0; k < 20; ++k) { // Limit to 20 for safety
      total += Array.from(this.wordsOfLength(k)).length;
    }
    return total;
  }

  // Returns the minimum word length accepted by the DFA
  minimumWordLength(): number | null {
    // BFS from start, track distance to accept
    const queue: Array<{ state: string; len: number }> = [
      { state: this.start, len: 0 },
    ];
    const visited = new Set<string>();
    while (queue.length) {
      const { state, len } = queue.shift()!;
      if (visited.has(state)) continue;
      visited.add(state);
      if (this.accept.includes(state)) return len;
      for (const t of this.transitions) {
        if (t.from === state && !visited.has(t.to)) {
          queue.push({ state: t.to, len: len + 1 });
        }
      }
    }
    return null;
  }

  // Returns the maximum word length accepted by the DFA (null if infinite)
  maximumWordLength(): number | null {
    if (!this.isfinite()) return null;
    // Use BFS to find the longest path to an accept state
    const queue: Array<{ state: string; len: number }> = [
      { state: this.start, len: 0 },
    ];
    let maxLen = 0;
    const visited = new Set<string>();
    while (queue.length) {
      const { state, len } = queue.shift()!;
      if (visited.has(state)) continue;
      visited.add(state);
      if (this.accept.includes(state) && len > maxLen) maxLen = len;
      for (const t of this.transitions) {
        if (t.from === state && !visited.has(t.to)) {
          queue.push({ state: t.to, len: len + 1 });
        }
      }
    }
    return maxLen;
  }
}
