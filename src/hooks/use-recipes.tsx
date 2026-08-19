import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { Recipe, RecipeIngredient, RecipeInput } from '@/types/recipe';

export function useRecipes() {
  const { household } = useHousehold();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });

    if (!error) {
      setRecipes(
        ((data ?? []) as (Recipe & { recipe_ingredients: RecipeIngredient[] })[]).map((r) => ({
          ...r,
          ingredients: r.recipe_ingredients ?? [],
        }))
      );
    }
    setLoading(false);
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount; load's own setState calls drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addRecipe = useCallback(
    async (input: RecipeInput) => {
      if (!household) return;
      const { data: recipe, error: recipeError } = await supabase
        .from('recipes')
        .insert({
          household_id: household.id,
          title: input.title.trim(),
          instructions: input.instructions?.trim() || null,
          servings: input.servings,
          category: input.category,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (recipeError) throw recipeError;

      const ingredientRows = input.ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({ recipe_id: recipe.id, name: i.name.trim(), quantity: i.quantity, category: i.category }));

      let ingredients: RecipeIngredient[] = [];
      if (ingredientRows.length > 0) {
        const { data: insertedIngredients, error: ingredientsError } = await supabase
          .from('recipe_ingredients')
          .insert(ingredientRows)
          .select();
        if (ingredientsError) throw ingredientsError;
        ingredients = insertedIngredients as RecipeIngredient[];
      }

      setRecipes((prev) => [...prev, { ...(recipe as Recipe), ingredients }]);
    },
    [household, currentUserId]
  );

  const updateRecipe = useCallback(async (recipe: Recipe, input: RecipeInput) => {
    const { error: recipeError } = await supabase
      .from('recipes')
      .update({
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        servings: input.servings,
        category: input.category,
      })
      .eq('id', recipe.id);
    if (recipeError) throw recipeError;

    // Simplest correct way to sync the ingredient list on an edit: replace
    // it wholesale rather than diffing — recipes are edited rarely enough
    // that this isn't worth the complexity of matching old rows to new ones.
    const { error: deleteError } = await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipe.id);
    if (deleteError) throw deleteError;

    const ingredientRows = input.ingredients
      .filter((i) => i.name.trim())
      .map((i) => ({ recipe_id: recipe.id, name: i.name.trim(), quantity: i.quantity, category: i.category }));

    let ingredients: RecipeIngredient[] = [];
    if (ingredientRows.length > 0) {
      const { data: insertedIngredients, error: ingredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows)
        .select();
      if (ingredientsError) throw ingredientsError;
      ingredients = insertedIngredients as RecipeIngredient[];
    }

    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipe.id
          ? {
              ...r,
              title: input.title.trim(),
              instructions: input.instructions?.trim() || null,
              servings: input.servings,
              category: input.category,
              ingredients,
            }
          : r
      )
    );
  }, []);

  const deleteRecipe = useCallback(async (recipe: Recipe) => {
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    const { error } = await supabase.from('recipes').delete().eq('id', recipe.id);
    if (error) {
      setRecipes((prev) => [...prev, recipe].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  return { recipes, loading, addRecipe, updateRecipe, deleteRecipe };
}
