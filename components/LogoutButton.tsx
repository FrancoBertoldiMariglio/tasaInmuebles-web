'use client';

import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        router.push('/login');
        router.refresh();
      }}
      className="mt-sm w-full text-left px-md py-sm rounded-md text-ds-sm text-ink-muted2 hover:bg-surface-pageAlt hover:text-ink-primary transition-colors duration-fast"
    >
      Cerrar sesión
    </button>
  );
}
