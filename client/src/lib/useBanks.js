'use client';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';

// the main agency's active bank accounts (agents and staff can read, only the main admin can change)
export default function useBanks(all = false) {
  const [banks, setBanks] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    let q = supabase.from('bank_accounts').select('*').order('sort').order('created_at');
    if (!all) q = q.eq('active', true);
    const { data } = await q;
    setBanks(data || []);
    setLoaded(true);
  }, [all]);
  useEffect(() => { load(); }, [load]);
  return { banks, loaded, reload: load };
}
