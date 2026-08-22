import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { useTranslation } from '@/hooks/use-language';
import { getAuthCallbackUrl, supabase } from '@/lib/supabase';
import type { Profile } from '@/types/household';

type ProfilePatch = Partial<Pick<Profile, 'full_name' | 'phone' | 'kennitala'>>;

/** The signed-in user's own profile — editable contact info, avatar upload,
 * and sign-out. Separate from `useHousehold` (which is about the group),
 * though it leans on it to keep the household roster's cached copy of
 * name/avatar/xp in sync after an edit here. */
export function useProfile() {
  const t = useTranslation();
  const { refresh: refreshHousehold } = useHousehold();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const load = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setUserId(user.id);
    setEmail(user.email ?? null);

    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error) setProfile(data as Profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount; load's own setState calls drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      if (!userId) return;
      const { data, error } = await supabase.from('profiles').update(patch).eq('id', userId).select().single();
      if (error) throw error;
      setProfile(data as Profile);
      // Full name shows on the household roster too — keep it in sync.
      refreshHousehold();
    },
    [userId, refreshHousehold]
  );

  const pickAndUploadAvatar = useCallback(async () => {
    if (!userId) return;

    // No-ops on web (the browser's own file picker handles access there);
    // required on native to actually get the library open.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error(t('avatarPermissionRequired'));
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

    // Derived from mimeType, not the asset's uri — on web that uri is a
    // extension-less `blob:http://...` URL, which produced a garbage
    // storage path when this used to split on ".".
    const contentType = asset.mimeType ?? 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    // Same path every time (upsert) rather than a unique name each upload —
    // no orphaned files piling up in storage as people change their avatar.
    const path = `${userId}/avatar.${ext}`;

    setUploadingAvatar(true);
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, decode(asset.base64), { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path);
      // Same path reused on every upload means the same URL would otherwise
      // serve a stale cached image — cache-bust with a version query param.
      const avatarUrl = `${publicUrl}?v=${Date.now()}`;

      const { data, error } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId).select().single();
      if (error) throw error;
      setProfile(data as Profile);
      refreshHousehold();
    } finally {
      setUploadingAvatar(false);
    }
  }, [userId, refreshHousehold, t]);

  const removeAvatar = useCallback(async () => {
    if (!userId || !profile?.avatar_url) return;
    const previousUrl = profile.avatar_url;

    const { data, error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', userId).select().single();
    if (error) throw error;
    setProfile(data as Profile);
    refreshHousehold();

    // Best-effort cleanup of the actual file — the profile update above is
    // what matters for the UI, this just avoids leaving it orphaned in
    // storage. A failure here shouldn't surface as an error to the person.
    const path = previousUrl.split('/avatars/')[1]?.split('?')[0];
    if (path) {
      supabase.storage
        .from('avatars')
        .remove([path])
        .catch(() => {});
    }
  }, [userId, profile, refreshHousehold]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!email) throw new Error(t('changePasswordMissingEmail'));
      // Re-authenticate with the current password first rather than just
      // calling updateUser directly — an already-open session shouldn't be
      // enough on its own to silently take over the account (e.g. a
      // left-open browser tab on a shared device).
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
      if (reauthError) throw new Error(t('changePasswordCurrentIncorrect'));

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
    },
    [email, t]
  );

  const changeEmail = useCallback(async (newEmail: string) => {
    // Doesn't take effect immediately — Supabase emails a confirmation
    // link (to the new address, and to the old one too if the project has
    // "Secure email change" on) that lands on auth-callback.tsx. The
    // account's email here stays the old one until that's clicked.
    const { error } = await supabase.auth.updateUser({ email: newEmail }, { emailRedirectTo: getAuthCallbackUrl() });
    if (error) throw error;
  }, []);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) throw error;
    // The server-side deletion doesn't invalidate an already-cached client
    // session by itself — sign out locally too so the UI reflects it
    // immediately instead of appearing to still be logged in.
    await supabase.auth.signOut();
  }, []);

  return {
    loading,
    profile,
    email,
    uploadingAvatar,
    updateProfile,
    pickAndUploadAvatar,
    removeAvatar,
    signOut,
    changePassword,
    changeEmail,
    deleteAccount,
  };
}
