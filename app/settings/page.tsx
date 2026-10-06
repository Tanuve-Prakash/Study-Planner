'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function SettingsPage() {
  const router = useRouter();
  const [dailyHours, setDailyHours] = useState<number>(4);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      setUserId(user.id);

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('daily_hours')
          .eq('id', user.id)
          .single();

        if (data && data.daily_hours !== null && data.daily_hours !== undefined) {
          setDailyHours(Number(data.daily_hours));
        } else if (error && error.code !== 'PGRST116') {
          // PGRST116 is "Row not found", which is normal for a fresh profile
          console.warn('Could not fetch existing profile:', error.message);
        }
      } catch (err: unknown) {
        console.error('Error fetching profile:', err);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;

    if (dailyHours < 0.5 || dailyHours > 16) {
      setError('Daily study hours must be between 0.5 and 16 hours.');
      return;
    }

    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          daily_hours: Number(dailyHours),
        });

      if (upsertError) throw upsertError;

      setSuccess('Settings saved successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <p className="text-gray-500 dark:text-zinc-400">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-4 sm:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            Settings
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            Configure your daily study capacity and preferences.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700 dark:bg-green-950/50 dark:text-green-400">
            {success}
          </div>
        )}

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="daily-hours"
                className="block text-base font-semibold text-gray-900 dark:text-zinc-100"
              >
                Daily Study Hours
              </label>
              <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                Set how many hours per day you plan to dedicate to studying (0.5 to 16 hours).
              </p>

              <div className="mt-4 flex items-center space-x-4">
                <input
                  id="daily-hours"
                  type="number"
                  min="0.5"
                  max="16"
                  step="0.5"
                  required
                  value={dailyHours}
                  onChange={(e) => setDailyHours(parseFloat(e.target.value) || 0.5)}
                  className="block w-28 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-zinc-300">
                  hours / day
                </span>
              </div>

              {/* Slider for quick adjustment */}
              <div className="mt-4">
                <input
                  type="range"
                  min="0.5"
                  max="16"
                  step="0.5"
                  value={dailyHours}
                  onChange={(e) => setDailyHours(parseFloat(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-zinc-700 accent-blue-600"
                />
                <div className="flex justify-between text-xs text-gray-400 dark:text-zinc-500 mt-1">
                  <span>0.5h</span>
                  <span>4h</span>
                  <span>8h</span>
                  <span>12h</span>
                  <span>16h</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
