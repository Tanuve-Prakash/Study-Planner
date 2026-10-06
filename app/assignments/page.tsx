'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';

interface Subject {
  id: string;
  name: string;
  color?: string;
}

interface Assignment {
  id: string;
  title: string;
  subject_id: string;
  due_date: string;
  estimated_hours: number;
  status: string;
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      await fetchData();
      setLoading(false);
    }

    init();
  }, [router]);

  const fetchData = async () => {
    try {
      const [subjectsRes, assignmentsRes] = await Promise.all([
        supabase.from('subjects').select('*'),
        supabase.from('assignments').select('*'),
      ]);

      if (subjectsRes.error) throw subjectsRes.error;
      if (assignmentsRes.error) throw assignmentsRes.error;

      setSubjects(subjectsRes.data || []);
      setAssignments(assignmentsRes.data || []);

      if (subjectsRes.data && subjectsRes.data.length > 0 && !subjectId) {
        setSubjectId(subjectsRes.data[0].id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch data';
      console.error('Fetch error:', msg);
      setError(msg);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !subjectId || !dueDate || !estimatedHours) return;

    setError(null);
    setIsSubmitting(true);

    try {
      const newAssignment = {
        title: title.trim(),
        subject_id: subjectId,
        due_date: dueDate,
        estimated_hours: Number(estimatedHours),
        status: 'pending',
      };

      const { data, error: insertError } = await supabase
        .from('assignments')
        .insert([newAssignment])
        .select();

      if (insertError) throw insertError;

      if (data && data[0]) {
        setAssignments((prev) => [...prev, data[0]]);
      } else {
        await fetchData();
      }

      // Reset form
      setTitle('');
      setDueDate('');
      setEstimatedHours('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add assignment';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleDone = async (assignment: Assignment) => {
    const newStatus = assignment.status === 'done' ? 'pending' : 'done';
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('assignments')
        .update({ status: newStatus })
        .eq('id', assignment.id);

      if (updateError) throw updateError;

      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignment.id ? { ...a, status: newStatus } : a
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update assignment';
      setError(msg);
    }
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    setError(null);
    try {
      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignmentId);

      if (deleteError) throw deleteError;

      setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete assignment';
      setError(msg);
    }
  };

  const formatDueDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <p className="text-gray-500 dark:text-zinc-400">Loading assignments...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 p-4 sm:p-8 dark:bg-zinc-950">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            Assignments
          </h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            Track and manage your upcoming assignments, projects, and due dates.
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Add Assignment Form */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">
            Add New Assignment
          </h2>

          {subjects.length === 0 ? (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Please{' '}
              <Link href="/subjects" className="font-semibold underline">
                add at least one subject
              </Link>{' '}
              before creating an assignment.
            </div>
          ) : (
            <form onSubmit={handleAddAssignment} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
              <div>
                <label
                  htmlFor="assignment-title"
                  className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
                >
                  Title
                </label>
                <input
                  id="assignment-title"
                  type="text"
                  required
                  placeholder="e.g. Lab Report 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="assignment-subject"
                  className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
                >
                  Subject
                </label>
                <select
                  id="assignment-subject"
                  required
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  <option value="" disabled>
                    Select subject...
                  </option>
                  {subjects.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="assignment-due-date"
                  className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
                >
                  Due Date
                </label>
                <input
                  id="assignment-due-date"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex-1">
                  <label
                    htmlFor="assignment-hours"
                    className="block text-sm font-medium text-gray-700 dark:text-zinc-300"
                  >
                    Est. Hours
                  </label>
                  <input
                    id="assignment-hours"
                    type="number"
                    min="0.5"
                    step="0.5"
                    required
                    placeholder="e.g. 3.5"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Assignments List */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-50">
            Assignments List
          </h2>

          {assignments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center dark:border-zinc-800">
              <p className="text-sm text-gray-500 dark:text-zinc-400">
                No assignments recorded yet. Add your first assignment above.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 overflow-hidden">
              {assignments.map((assignment) => {
                const subject = subjects.find(
                  (s) => s.id === assignment.subject_id
                );
                const isDone = assignment.status === 'done';

                return (
                  <div
                    key={assignment.id}
                    className={`flex flex-wrap items-center justify-between gap-4 p-4 transition-colors ${
                      isDone
                        ? 'bg-gray-50/60 dark:bg-zinc-900/40 opacity-75'
                        : 'hover:bg-gray-50/40 dark:hover:bg-zinc-800/30'
                    }`}
                  >
                    <div className="flex items-center space-x-3.5">
                      {/* Mark Done Checkbox */}
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isDone}
                          onChange={() => handleToggleDone(assignment)}
                          className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800"
                        />
                        <span className="sr-only">Mark done</span>
                      </label>

                      <div>
                        <p
                          className={`text-base font-semibold ${
                            isDone
                              ? 'line-through text-gray-400 dark:text-zinc-500'
                              : 'text-gray-900 dark:text-zinc-100'
                          }`}
                        >
                          {assignment.title}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
                          {subject && (
                            <span
                              className="inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs text-white"
                              style={{
                                backgroundColor: subject.color || '#3B82F6',
                              }}
                            >
                              {subject.name}
                            </span>
                          )}
                          <span>Due: {formatDueDate(assignment.due_date)}</span>
                          <span>•</span>
                          <span>Est. {assignment.estimated_hours}h</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          isDone
                            ? 'bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {isDone ? 'Done' : 'Pending'}
                      </span>

                      <button
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        title="Delete Assignment"
                        className="rounded p-1 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
