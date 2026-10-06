'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        setLoading(false);
      }
    }

    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        router.push('/login');
      } else {
        setUser(session.user);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-zinc-950">
        <p className="text-gray-500 dark:text-zinc-400">Loading...</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-4xl rounded-xl bg-white p-8 shadow-md dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-gray-200 pb-6 dark:border-zinc-800">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
              Welcome
            </h1>
            <p className="mt-2 text-lg text-gray-600 dark:text-zinc-300">
              {user.email}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
