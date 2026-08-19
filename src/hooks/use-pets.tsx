import { decode } from 'base64-arraybuffer';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Pet, PetInput } from '@/types/pet';

/** Pet profiles for a household — name/species/breed. Care tasks (feeding,
 * vet visits, grooming, ...) live separately in use-pet-care.tsx, scoped to
 * a specific pet id. */
export function usePets() {
  const { household } = useHousehold();
  const [pets, setPets] = useState<Pet[]>([]);
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
      setPets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('pets')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) setPets((data ?? []) as Pet[]);
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addPet = useCallback(
    async (input: PetInput) => {
      if (!household) return;
      const { data, error } = await supabase
        .from('pets')
        .insert({
          household_id: household.id,
          name: input.name.trim(),
          species: input.species,
          breed: input.breed,
          birth_date: input.birthDate,
          notes: input.notes,
          created_by: currentUserId,
        })
        .select()
        .single();

      if (error) throw error;
      setPets((prev) => [...prev, data as Pet]);
    },
    [household, currentUserId]
  );

  const updatePet = useCallback(async (pet: Pet, input: PetInput) => {
    const patch = {
      name: input.name.trim(),
      species: input.species,
      breed: input.breed,
      birth_date: input.birthDate,
      notes: input.notes,
    };
    setPets((prev) => prev.map((p) => (p.id === pet.id ? { ...p, ...patch } : p)));
    const { error } = await supabase.from('pets').update(patch).eq('id', pet.id);
    if (error) {
      setPets((prev) => prev.map((p) => (p.id === pet.id ? pet : p)));
      throw error;
    }
  }, []);

  // Mirrors use-profile.tsx's pickAndUploadAvatar/removeAvatar exactly,
  // just scoped to a pet id (path "<pet_id>/photo.<ext>") instead of the
  // signed-in user's own id, and writing to the pets table instead of
  // profiles — a pet's photo belongs to the whole household, not one person.
  const pickAndUploadPetAvatar = useCallback(async (pet: Pet) => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required to add a pet photo.');
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
    const path = `${pet.id}/photo.${ext}`;

    setUploadingAvatarId(pet.id);
    try {
      const { error: uploadError } = await supabase.storage
        .from('pet-photos')
        .upload(path, decode(asset.base64), { contentType, upsert: true });
      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from('pet-photos').getPublicUrl(path);
      const avatarUrl = `${publicUrl}?v=${Date.now()}`;

      const { data, error } = await supabase.from('pets').update({ avatar_url: avatarUrl }).eq('id', pet.id).select().single();
      if (error) throw error;
      setPets((prev) => prev.map((p) => (p.id === pet.id ? (data as Pet) : p)));
    } finally {
      setUploadingAvatarId(null);
    }
  }, []);

  const removePetAvatar = useCallback(async (pet: Pet) => {
    if (!pet.avatar_url) return;
    const previousUrl = pet.avatar_url;

    const { data, error } = await supabase.from('pets').update({ avatar_url: null }).eq('id', pet.id).select().single();
    if (error) throw error;
    setPets((prev) => prev.map((p) => (p.id === pet.id ? (data as Pet) : p)));

    // Best-effort cleanup of the actual file — the row update above is what
    // matters for the UI, this just avoids leaving it orphaned in storage.
    const path = previousUrl.split('/pet-photos/')[1]?.split('?')[0];
    if (path) {
      supabase.storage
        .from('pet-photos')
        .remove([path])
        .catch(() => {});
    }
  }, []);

  const deletePet = useCallback(async (pet: Pet) => {
    setPets((prev) => prev.filter((p) => p.id !== pet.id));
    const { error } = await supabase.from('pets').delete().eq('id', pet.id);
    if (error) {
      setPets((prev) => [...prev, pet].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return {
    pets,
    loading,
    currentUserId,
    uploadingAvatarId,
    addPet,
    updatePet,
    deletePet,
    pickAndUploadPetAvatar,
    removePetAvatar,
    refresh: load,
  };
}
