import { useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import LedgerTable from '@/components/LedgerTable';
import { money } from '@/lib/format';

export default function AdminLedger() {
  const [balances, setBalances] = useState([]);
  const [sel, setSel] = useState(null);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('agent_balances').select('*').then(({ data, error }) => {
      if (error) setError(error.message); else setBalances(data);
      setLoaded(true);
    });
  }, []);

  async function pick(a) {
    setSel(a); setRows([]); setError('');
    const { data, error } = await supabase.from('agent_ledger').select('*').eq('agent_id', a.agent_id);
    if (error) setError(error.message); else setRows(data);
  }

  const due = a => Number(a.total_booked) - Number(a.total_paid);
  const sorted = [...balances].sort((a, b) => due(b) - due(a));

  return (
    <Shell role="admin" title="Agent Ledgers">
      {error && <div className="error">{error}</div>}
      {sel ? (
        <div className="card">
          <div className="top">
            <h2 style={{ margin: 0 }}>{sel.agency_name}</h2>
            <div className="actions"><button className="ghost" onClick={() => window.print()}>Print</button><button className="ghost" onClick={() => setSel(null)}>← All agents</button></div>
          </div>
          <LedgerTable rows={rows} />
        </div>
      ) : (
        <div className="card">
          {!loaded ? <p className="muted">Loading...</p> : sorted.length === 0 ? <p className="muted">No agents yet.</p> : (
            <div className="scroll"><table>
              <thead><tr><th>Agency</th><th>Total booked</th><th>Total paid</th><th>Balance due</th><th></th></tr></thead>
              <tbody>
                {sorted.map(a => (
                  <tr key={a.agent_id}>
                    <td><b>{a.agency_name}</b></td><td>{money(a.total_booked)}</td><td>{money(a.total_paid)}</td>
                    <td className={due(a) > 0 ? 'neg' : 'pos'}>{money(due(a))}</td>
                    <td><button className="ghost" onClick={() => pick(a)}>View ledger</button></td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
      )}
    </Shell>
  );
}
