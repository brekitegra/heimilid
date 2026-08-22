import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Note, NoteInput } from '@/types/note';

/** Household-shared, like bills/chores — a basic shared notice board, no
 * completion state or ordering beyond newest-first. */
export function useNotes() {
  const { household } = useHousehold();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setNotes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false });

    if (error) setError(error.message);
    else {
      setError(null);
      setNotes((data ?? []) as Note[]);
    }
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addNote = useCallback(
    async (input: NoteInput) => {
      if (!household || !currentUserId) return;

      const { data, error } = await supabase
        .from('notes')
        .insert({ household_id: household.id, body: input.body.trim(), created_by: currentUserId })
        .select()
        .single();

      if (error) throw error;
      setNotes((prev) => [data as Note, ...prev]);
    },
    [household, currentUserId]
  );

  const updateNote = useCallback(async (note: Note, input: NoteInput) => {
    const patch = { body: input.body.trim(), updated_at: new Date().toISOString() };

    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, ...patch } : n)));
    const { error } = await supabase.from('notes').update(patch).eq('id', note.id);
    if (error) {
      setNotes((prev) => prev.map((n) => (n.id === note.id ? note : n)));
      throw error;
    }
  }, []);

  const deleteNote = useCallback(async (note: Note) => {
    setNotes((prev) => prev.filter((n) => n.id !== note.id));
    const { error } = await supabase.from('notes').delete().eq('id', note.id);
    if (error) {
      setNotes((prev) => [note, ...prev].sort((a, b) => b.created_at.localeCompare(a.created_at)));
      throw error;
    }
  }, []);

  return {
    notes,
    loading,
    error,
    currentUserId,
    addNote,
    updateNote,
    deleteNote,
    refresh: load,
  };
}
