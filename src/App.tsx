import { useState, useRef, useEffect } from 'react';
import { Network, DataSet } from 'vis-network/standalone';
import type { Node, Edge } from 'vis-network/standalone';
import './App.css';

// Simple automaton parser (DFA/NFA, basic format)
function parseAutomaton(text: string) {
  // Example format:
  // states: q0,q1,q2
  // alphabet: 0,1
  // start: q0
  // accept: q2
  // transitions:
  // q0,0->q1
  // q0,1->q0
  // ...
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const states = lines.find(l => l.startsWith('states:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
  const alphabet = lines.find(l => l.startsWith('alphabet:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
  const start = lines.find(l => l.startsWith('start:'))?.split(':')[1]?.trim() || '';
  const accept = lines.find(l => l.startsWith('accept:'))?.split(':')[1]?.split(',').map(s => s.trim()) || [];
  const transitions: Array<{from: string, symbol: string, to: string}> = [];
  let inTrans = false;
  for (const l of lines) {
    if (l.startsWith('transitions:')) { inTrans = true; continue; }
    if (inTrans && l.includes('->')) {
      const [left, to] = l.split('->').map(s => s.trim());
      const [from, symbol] = left.split(',').map(s => s.trim());
      transitions.push({ from, symbol, to });
    }
  }
  return { states, alphabet, start, accept, transitions };
}

function automatonToVisData(automaton: ReturnType<typeof parseAutomaton>) {
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
      // Always assign (from->to) as curvedCW, (to->from) as curvedCCW for each unique pair
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
      // Self-loop: use a loop edge
      smooth = { enabled: true, type: 'loop', roundness: 0.5 };
      font = { align: 'top', vadjust: -20 };
    } else if (bidirectionalMap.has(key)) {
      // Use explicit direction for each edge in a bidirectional pair
      const dir = bidirectionalMap.get(key);
      smooth = { enabled: true, type: dir === 'cw' ? 'curvedCW' : 'curvedCCW', roundness: 0.4 };
      font = { align: 'top', vadjust: dir === 'cw' ? -12 : 12 };
    } else if (transitions.length > 1) {
      // Multiple edges: curve them in both directions
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
  const [automaton, setAutomaton] = useState(() => parseAutomaton(definition));
  const [word, setWord] = useState('010');
  const [result, setResult] = useState<string | null>(null);
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
          enabled: true,
          initiallyActive: false,
          addEdge: false,
          addNode: false,
          deleteEdge: false,
          deleteNode: false,
          editEdge: true, // allow moving edge control points
        },
      });
    }
  }, [automaton]);

  function handleParse() {
    setAutomaton(parseAutomaton(definition));
    setResult(null);
  }

  function runWord() {
    let current = automaton.start;
    for (const symbol of word) {
      const t = automaton.transitions.find(tr => tr.from === current && tr.symbol === symbol);
      if (!t) { setResult('Rejected'); return; }
      current = t.to;
    }
    setResult(automaton.accept.includes(current) ? 'Accepted' : 'Rejected');
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
