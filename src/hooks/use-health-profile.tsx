import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import type { HealthProfile, HealthProfileInput } from '@/types/health-profile';

/** The signed-in user's own body stats, TDEE inputs, and daily targets —
 * private to them, no household involved at all (unlike every other hook
 * in this app). Null until they've filled in the calculator at least
 * once; not auto-created, since "no profile yet" is a real, meaningful
 * state here (there's nothing sensible to default body stats to). */
export function useHealthProfile() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.from('health_profiles').select('*').eq('user_id', user.id).limit(1);
    if (!error) setProfile((data?.[0] as HealthProfile) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    // Intentional fetch-on-mount; load's own setState calls drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const save = useCallback(
    async (input: HealthProfileInput) => {
      if (!userId) return;
      const { data, error } = await supabase
        .from('health_profiles')
        .upsert(
          {
            user_id: userId,
            age: input.age,
            weight_kg: input.weightKg,
            height_cm: input.heightCm,
            sex: input.sex,
            activity_level: input.activityLevel,
            goal: input.goal,
            calorie_target: input.calorieTarget,
            protein_target_g: input.proteinTargetG,
            fat_target_g: input.fatTargetG,
            carb_target_g: input.carbTargetG,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      setProfile(data as HealthProfile);
    },
    [userId]
  );

  return { profile, loading, save, refresh: load };
}
