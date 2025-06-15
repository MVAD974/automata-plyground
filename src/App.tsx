import { useState, useRef, useEffect } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import type { Node, Edge } from 'vis-network/standalone';
import './App.css';
import { DFA } from './dfa';

function automatonToVisData(automaton: DFA) {
  const nodes: Node[] = automaton.states.map(s => ({
    id: s,
    label: s,
    shape: automaton.accept.includes(s) ? 'ellipse' : 'circle',
    color: automaton.accept.includes(s) ? '#aaffaa' : '#ddddff',
    borderWidth: automaton.start === s ? 3 : 1,
  }));

  // Group transitions by (from, to)
  const grouped: Record<string, Array<{ symbol: string; from: string; to: string }>> = {};
  for (const t of automaton.transitions) {
    const key = `${t.from}->${t.to}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  }

  // Detect bidirectional edges and assign curve direction
  const bidirectionalMap = new Map<string, 'cw' | 'ccw'>();
  Object.keys(grouped).forEach(key => {
    const [from, to] = key.split('->');
    const reverseKey = `${to}->${from}`;
    if (grouped[reverseKey]) {
      if (!bidirectionalMap.has(key) && !bidirectionalMap.has(reverseKey)) {
        bidirectionalMap.set(key, 'cw');
        bidirectionalMap.set(reverseKey, 'cw');
      }
    }
  });

  const edges: Edge[] = [];
  Object.entries(grouped).forEach(([, transitions]) => {
    const { from, to } = transitions[0];
    const label = transitions.map(t => t.symbol).join(', ');
    let smooth: Edge['smooth'] = false;
    let font: Edge['font'] = { align: 'top' };
    const key = `${from}->${to}`;
    if (from === to) {
      smooth = { enabled: true, type: 'loop', roundness: 0.5 };
      font = { align: 'top', vadjust: -20 };
    } else if (bidirectionalMap.has(key)) {
      const dir = bidirectionalMap.get(key);
      smooth = { enabled: true, type: dir === 'cw' ? 'curvedCW' : 'curvedCCW', roundness: 0.4 };
      font = { align: 'top', vadjust: dir === 'cw' ? -12 : 12 };
    } else if (transitions.length > 1) {
      transitions.forEach((t, i) => {
        edges.push({
          from: t.from,
          to: t.to,
          label: t.symbol,
          arrows: 'to',
          color: '#888',
          font: { align: 'top', vadjust: i % 2 === 0 ? -10 : 10 },
          smooth: { enabled: true, type: i % 2 === 0 ? 'curvedCW' : 'curvedCCW', roundness: 0.3 + 0.15 * i },
        });
      });
      return;
    }
    edges.push({
      from,
      to,
      label,
      arrows: 'to',
      color: '#888',
      font,
      smooth,
    });
  });

  return { nodes, edges };
}

export default function App() {
  const [definition, setDefinition] = useState(
    `states: q0,q1,q2\nalphabet: 0,1\nstart: q0\naccept: q2\ntransitions:\nq0,0->q1\nq0,1->q0\nq1,0->q2\nq1,1->q0\nq2,0->q2\nq2,1->q2`
  );
  const [automaton, setAutomaton] = useState(() => DFA.fromDefinition(definition));
  const [word, setWord] = useState('010');
  const [result, setResult] = useState<string | null>(null);
  const [stateInput, setStateInput] = useState('');
  const [fromInput, setFromInput] = useState('');
  const [toInput, setToInput] = useState('');
  const [symbolInput, setSymbolInput] = useState('');
  const visRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<Network | null>(null);

  useEffect(() => {
    if (visRef.current) {
      const data = automatonToVisData(automaton);
      if (networkRef.current) networkRef.current.destroy();
      networkRef.current = new Network(visRef.current, {
        nodes: new DataSet(data.nodes),
        edges: new DataSet(data.edges),
      }, {
        nodes: { shape: 'circle', font: { size: 18 } },
        edges: { font: { size: 16 }, smooth: true },
        physics: false,
        height: '350px',
        interaction: { dragNodes: true, dragView: true, selectable: true },
        manipulation: {
          enabled: false,
          initiallyActive: false,
          addEdge: false,
          addNode: false,
          deleteEdge: false,
          deleteNode: false,
          editEdge: false,
        },
      });
    }
  }, [automaton]);

  function handleParse() {
    setAutomaton(DFA.fromDefinition(definition));
    setResult(null);
  }

  function runWord() {
    setResult(automaton.runWord(word) ? 'Accepted' : 'Rejected');
  }

  return (
    <div className="container" style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 8 }}>Automata Playground</h1>
      <div className="automata-ui" style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 320 }}>
          <h2>Definition</h2>
          <textarea
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            rows={12}
            style={{ width: '100%', fontFamily: 'monospace', fontSize: 15, borderRadius: 8, padding: 8, border: '1px solid #ccc' }}
          />
          <button onClick={handleParse} style={{ marginTop: 8, width: '100%' }}>Parse & Visualize</button>
          <div style={{ marginTop: 24 }}>
            <h2>Run Word</h2>
            <input
              value={word}
              onChange={e => setWord(e.target.value)}
              style={{ fontSize: 16, padding: 4, borderRadius: 4, border: '1px solid #ccc', width: '70%' }}
              placeholder="Enter word (e.g. 010)"
            />
            <button onClick={runWord} style={{ marginLeft: 8 }}>Run</button>
            {result && (
              <span style={{ marginLeft: 16, fontWeight: 'bold', color: result === 'Accepted' ? 'green' : 'red' }}>{result}</span>
            )}
          </div>
        </div>
        <div style={{ flex: 2, minWidth: 350 }}>
          <h2>Visualization</h2>
          <div ref={visRef} style={{ border: '1px solid #aaa', borderRadius: 8, background: '#fff', height: 350, minWidth: 320 }} />
          {/* Add state and transition UI */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="State name"
              value={stateInput}
              onChange={e => setStateInput(e.target.value)}
              style={{ padding: '0.5em', width: 100, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <button
              onClick={() => {
                const state = stateInput.trim();
                if (state) {
                  const lines = definition.split(/\r?\n/);
                  const statesIdx = lines.findIndex(l => l.startsWith('states:'));
                  if (statesIdx !== -1) {
                    const parts = lines[statesIdx].split(':');
                    const statesArr = parts[1].split(',').map(s => s.trim());
                    if (!statesArr.includes(state)) {
                      statesArr.push(state);
                      lines[statesIdx] = `states: ${statesArr.join(',')}`;
                      const newDef = lines.join('\n');
                      setDefinition(newDef);
                      setStateInput('');
                      setAutomaton(DFA.fromDefinition(newDef));
                    }
                  }
                }
              }}
              style={{ padding: '0.5em 1em', borderRadius: 6, background: '#4caf50', color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Add State
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, justifyContent: 'center', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="From"
              value={fromInput}
              onChange={e => setFromInput(e.target.value)}
              style={{ padding: '0.5em', width: 60, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <input
              type="text"
              placeholder="Symbol"
              value={symbolInput}
              onChange={e => setSymbolInput(e.target.value)}
              style={{ padding: '0.5em', width: 60, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <input
              type="text"
              placeholder="To"
              value={toInput}
              onChange={e => setToInput(e.target.value)}
              style={{ padding: '0.5em', width: 60, borderRadius: 6, border: '1px solid #ccc' }}
            />
            <button
              onClick={() => {
                const from = fromInput.trim();
                const to = toInput.trim();
                const symbol = symbolInput.trim();
                if (from && to && symbol) {
                  const newDef = definition.trim() + `\n${from},${symbol}->${to}`;
                  setDefinition(newDef);
                  setFromInput('');
                  setToInput('');
                  setSymbolInput('');
                  setAutomaton(DFA.fromDefinition(newDef));
                }
              }}
              style={{ padding: '0.5em 1em', borderRadius: 6, background: '#1976d2', color: '#fff', border: 'none', fontWeight: 600 }}
            >
              Add Transition
            </button>
          </div>
          <div style={{ marginTop: 16, color: '#888', fontSize: 14 }}>
            <em>Accept states are green. Start state has a thick border.</em>
          </div>
          <div style={{ marginTop: 24, color: '#aaa', fontSize: 13 }}>
            <strong>Step-by-step visualization coming soon!</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
