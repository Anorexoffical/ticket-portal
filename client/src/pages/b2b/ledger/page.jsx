import { useEffect, useState } from 'react';
import { supabase } from '@/lib/db';
import Shell from '@/components/Shell.jsx';
import LedgerTable from '@/components/LedgerTable';

export default function AgentLedger() {
  return <Shell role="agent" title="My Ledger">{p => <Inner id={p.id} />}</Shell>;
}

function Inner({ id }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    supabase.from('agent_ledger').select('*').eq('agent_id', id)
      .then(({ data, error }) => { if (error) setError(error.message); else setRows(data); });
  }, [id]);
  return (
    <div className="card">
      {error && <div className="error">{error}</div>}
      {rows && <><div className="actions noprint" style={{ marginBottom: 12 }}><button className="ghost" onClick={() => window.print()}>Print</button></div><LedgerTable rows={rows} /></>}
    </div>
  );
}
