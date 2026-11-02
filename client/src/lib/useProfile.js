'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export function useProfile(needRole) {
  const router = useRouter();
  const [state, setState] = useState({ loading: true, profile: null });

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active) return;
      const profile = session?.user;
      if (!profile) { router.replace('/login'); return; }
      const staff = ['admin', 'staff', 'superadmin'].includes(profile.role);
      if (needRole === 'admin' && !staff) { router.replace('/agent'); return; }
      if (needRole === 'agent' && staff) { router.replace('/admin'); return; }
      setState({ loading: false, profile: {
        ...profile,
        agency_name: profile.agencyName,
        owner_name: profile.ownerName,
        umrah_access: profile.umrahAccess,
      } });
    })();
    return () => { active = false; };
  }, [router, needRole]);

  return state;
}

export async function signOut(router) {
  await supabase.auth.signOut();
  router.replace('/login');
}
