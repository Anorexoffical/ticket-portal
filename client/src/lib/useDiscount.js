import { useEffect, useState } from 'react';
import { supabase } from './supabase';

// The logged-in agent's discount per ticket (set by the owner). The database enforces it too.
export default function useDiscount() {
  const [d, setD] = useState(0);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data?.user?.id; if (!id) return;
      supabase.from('profiles').select('discount_per_ticket').eq('id', id).single()
        .then(({ data }) => setD(Number(data?.discount_per_ticket) || 0));
    });
  }, []);
  return d;
}
export const priceFor = (price, d) => Math.max(0, Number(price) - Math.min(Number(d) || 0, Number(price)));
