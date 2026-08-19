import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Child, ChildInput } from '@/types/child';

/** Child profiles for a household — name/age/notes/photo/stars. Mirrors
 * use-pets.tsx exactly, including the avatar upload flow (same
 * expo-image-picker + upsert-by-fixed-path + cache-busting pattern), just
 * scoped to the child-photos bucket instead of pet-photos. Stars are read
 * here but only ever earned via the school-items/practices hooks (through
 * the award_child_stars RPC), never written directly from this hook. */
export function useChildren() {
  const { household } = useHousehold();
  const [children, setChildren] = useState<Child[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [uploadingAvatarId, setUploadingAvatarId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setChildren([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('children')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setChildren((data ?? []) as Child[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addChild = useCallback(
    async (input: ChildInput) => {
      if (!household) return;
      const { data, error } = await supabase
        .from('children')
        .insert({
          household_id: household.id,
          name: input.name.trim(),
          birth_date: input.birthDate,
          notes: input.notes,
          emergency_info: input.emergencyInfo,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setChildren((prev) => [...prev, data as Child]);
    },
    [household, currentUserId]
  );

  const updateChild = useCallback(async (child: Child, input: ChildInput) => {
    const patch = {
      name: input.name.trim(),
      birth_date: input.birthDate,
      notes: input.notes,
      emergency_info: input.emergencyInfo,
    };
    setChildren((prev) => prev.map((c) => (c.id === child.id ? { ...c, ...patch } : c)));
    const { error } = await supabase.from('children').update(patch).eq('id', child.id);
    if (error) {
      setChildren((prev) => prev.map((c) => (c.id === child.id ? child : c)));
      throw error;
    }
  }, []);

  // Stars are actually awarded server-side by a different hook
  // (use-school-items.tsx / use-practices.tsx, via the award_child_stars
  // RPC) — this just keeps this hook's own local `children` cache in sync
  // with that already-committed change, the same role `refreshHousehold()`
  // plays for Chores'/Pets' XP after `award_xp`. Called only after a
  // confirmed-successful RPC (the caller passes 0 on failure), so it can
  // never show a star change that didn't actually happen.
  const adjustLocalStars = useCallback((childId: string, delta: number) => {
    if (delta === 0) return;
    setChildren((prev) => prev.map((c) => (c.id === childId ? { ...c, stars: Math.max(0, c.stars + delta) } : c)));
  }, []);

  const deleteChild = useCallback(async (child: Child) => {
    setChildren((prev) => prev.filter((c) => c.id !== child.id));
    const { error } = await supabase.from('children').delete().eq('id', child.id);
    if (error) {
      setChildren((prev) => [...prev, child].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  const pickAndUploadChildAvatar = useCallback(async (child: Child) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required to add a photo.');
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;

    const contentType = asset.mimeType ?? 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${child.id}/photo.${ext}`;

    setUploadingAvatarId(child.id);
    try {
      const { error: uploadError } = await supabase.storage
        .from('child-photos')
        .upload(path, decode(asset.base64), { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('child-photos').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?v=${Date.now()}`;

      const { data, error } = await supabase.from('children').update({ avatar_url: avatarUrl }).eq('id', child.id).select().single();
      if (error) throw error;
      setChildren((prev) => prev.map((c) => (c.id === child.id ? (data as Child) : c)));
    } finally {
      setUploadingAvatarId(null);
    }
  }, []);

  const removeChildAvatar = useCallback(async (child: Child) => {
    if (!child.avatar_url) return;
    const previousUrl = child.avatar_url;

    const { data, error } = await supabase.from('children').update({ avatar_url: null }).eq('id', child.id).select().single();
    if (error) throw error;
    setChildren((prev) => prev.map((c) => (c.id === child.id ? (data as Child) : c)));

    const path = previousUrl.split('/child-photos/')[1]?.split('?')[0];
    if (path) {
      supabase.storage
        .from('child-photos')
        .remove([path])
        .catch(() => {});
    }
  }, []);

  return {
    children,
    loading,
    currentUserId,
    uploadingAvatarId,
    addChild,
    updateChild,
    deleteChild,
    adjustLocalStars,
    pickAndUploadChildAvatar,
    removeChildAvatar,
    refresh: load,
  };
}
