// Automaton interface and base class for finite automata
export interface Transition {
  from: string;
  symbol: string;
  to: string;
}

export interface Automaton {
  states: string[];
  alphabet: string[];
  start: string;
  accept: string[];
  transitions: Transition[];
  runWord(word: string): boolean;
}

export abstract class BaseAutomaton implements Automaton {
  states: string[];
  alphabet: string[];
  start: string;
  accept: string[];
  transitions: Transition[];

  constructor(states: string[], alphabet: string[], start: string, accept: string[], transitions: Transition[]) {
    this.states = states;
    this.alphabet = alphabet;
    this.start = start;
    this.accept = accept;
    this.transitions = transitions;
  }

  abstract runWord(word: string): boolean;

  // Add a state to the automaton
  addState(state: string) {
    if (!this.states.includes(state)) {
      this.states.push(state);
    }
  }

  // Remove a state and all related transitions
  removeState(state: string) {
    this.states = this.states.filter(s => s !== state);
    this.accept = this.accept.filter(s => s !== state);
    if (this.start === state) this.start = this.states[0] || '';
    this.transitions = this.transitions.filter(t => t.from !== state && t.to !== state);
  }

  // Check if a state exists
  hasState(state: string): boolean {
    return this.states.includes(state);
  }

  // Get all transitions from a state
  getTransitionsFrom(state: string) {
    return this.transitions.filter(t => t.from === state);
  }

  // Check if the automaton is deterministic
  isDeterministic(): boolean {
    const seen = new Set<string>();
    for (const t of this.transitions) {
      const key = `${t.from},${t.symbol}`;
      if (seen.has(key)) return false;
      seen.add(key);
    }
    return true;
  }

  // Check if the automaton is complete (every state has a transition for every symbol)
  isComplete(): boolean {
    for (const state of this.states) {
      for (const symbol of this.alphabet) {
        if (!this.transitions.some(t => t.from === state && t.symbol === symbol)) {
          return false;
        }
      }
    }
    return true;
  }

  // Iterate over all transitions in the automaton
  *iterTransitions(): Generator<Transition, void, unknown> {
    for (const t of this.transitions) {
      yield t;
    }
  }

  /**
   * Trace the path taken by an input word through the automaton.
   * Returns an array of {from, to, symbol} and whether the word is accepted.
   */
  getInputPath(word: string): { path: Transition[]; accepted: boolean } {
    let current = this.start;
    const path: Transition[] = [];
    for (const symbol of word) {
      const t = this.transitions.find(tr => tr.from === current && tr.symbol === symbol);
      if (!t) {
        return { path, accepted: false };
      }
      path.push(t);
      current = t.to;
    }
    return { path, accepted: this.accept.includes(current) };
  }

  /**
   * Static utility to add a new unique state to a set of states.
   * Returns the new state name (e.g., qN).
   */
  static addNewState(states: Set<string>, prefix = 'q'): string {
    let i = 0;
    let candidate = `${prefix}${i}`;
    while (states.has(candidate)) {
      i++;
      candidate = `${prefix}${i}`;
    }
    states.add(candidate);
    return candidate;
  }
}
