import { useCallback, useEffect, useState } from 'react';

import { useHousehold } from '@/hooks/use-household';
import { supabase } from '@/lib/supabase';
import type { GroceryCategory, GroceryItem, GroceryItemInput, GroceryList, PantryStaple } from '@/types/grocery';

type TemplateWithItems = GroceryList & { items: GroceryItem[] };

/** Groceries: one persistent "active" list per household (created lazily
 * the first time anyone visits), a set of saved reusable list templates,
 * and pantry staples that can be added to the active list in one tap. */
export function useGrocery() {
  const { household } = useHousehold();
  const [activeList, setActiveList] = useState<GroceryList | null>(null);
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [templates, setTemplates] = useState<TemplateWithItems[]>([]);
  const [staples, setStaples] = useState<PantryStaple[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null);
    });
  }, []);

  const load = useCallback(async () => {
    if (!household) {
      setActiveList(null);
      setItems([]);
      setTemplates([]);
      setStaples([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // Ordered + limited to 1 rather than .maybeSingle() — that throws if
    // more than one row ever matches, which an earlier, less careful
    // version of this could itself cause (see the insert-conflict handling
    // below). This way a stray duplicate can never wedge every future load.
    const { data: existingLists } = await supabase
      .from('grocery_lists')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_template', false)
      .order('created_at', { ascending: true })
      .limit(1);

    let list: GroceryList | null = (existingLists?.[0] as GroceryList) ?? null;

    if (!list) {
      // First time anyone on this household opens Groceries — create the
      // one persistent active list on the spot. Reads the user id fresh
      // here (rather than depending on `currentUserId` state) so `load`'s
      // own identity doesn't change when that state resolves shortly after
      // mount — that was exactly what caused this to sometimes run twice
      // in near-parallel, both seeing "no list yet" and both inserting one.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data: created, error: createError } = await supabase
        .from('grocery_lists')
        .insert({ household_id: household.id, name: 'Grocery List', is_template: false, created_by: user?.id ?? null })
        .select()
        .single();

      if (created) {
        list = created as GroceryList;
      } else if (createError?.code === '23505') {
        // A concurrent request (another tab, or this same race) won —
        // the one-active-list-per-household unique index rejected ours.
        // Just fetch theirs instead of erroring.
        const { data: raceWinner } = await supabase
          .from('grocery_lists')
          .select('*')
          .eq('household_id', household.id)
          .eq('is_template', false)
          .order('created_at', { ascending: true })
          .limit(1)
          .single();
        list = (raceWinner as GroceryList) ?? null;
      }
    }

    if (list) {
      setActiveList(list);
      const { data: itemRows } = await supabase
        .from('grocery_items')
        .select('*')
        .eq('list_id', list.id)
        .order('created_at', { ascending: true });
      setItems((itemRows ?? []) as GroceryItem[]);
    }

    const { data: templateRows } = await supabase
      .from('grocery_lists')
      .select('*, grocery_items(*)')
      .eq('household_id', household.id)
      .eq('is_template', true)
      .order('created_at', { ascending: false });
    setTemplates(
      ((templateRows ?? []) as (GroceryList & { grocery_items: GroceryItem[] })[]).map((t) => ({
        ...t,
        items: t.grocery_items ?? [],
      }))
    );

    const { data: stapleRows } = await supabase
      .from('pantry_staples')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });
    setStaples((stapleRows ?? []) as PantryStaple[]);

    setLoading(false);
    // Deliberately NOT depending on currentUserId — it resolves shortly
    // after mount, and depending on it here is exactly what caused `load`
    // to re-run in near-parallel with itself (see the race note above).
  }, [household]);

  useEffect(() => {
    // Intentional fetch-on-mount (and whenever the household changes);
    // load's own setState calls are what drive `loading`.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const addItem = useCallback(
    async (input: GroceryItemInput) => {
      if (!activeList) return;
      const { data, error } = await supabase
        .from('grocery_items')
        .insert({
          list_id: activeList.id,
          name: input.name.trim(),
          quantity: input.quantity,
          category: input.category,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (error) throw error;
      setItems((prev) => [...prev, data as GroceryItem]);
    },
    [activeList, currentUserId]
  );

  const toggleItem = useCallback(
    async (item: GroceryItem) => {
      const nextChecked = !item.is_checked;
      // Whoever actually checks it off gets the credit, same "helping out
      // counts" idea as chores' completed_by — cleared again on undo.
      const patch = { is_checked: nextChecked, checked_by: nextChecked ? currentUserId : null };
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...patch } : i)));
      const { error } = await supabase.from('grocery_items').update(patch).eq('id', item.id);
      if (error) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
        throw error;
      }
    },
    [currentUserId]
  );

  const updateItem = useCallback(async (item: GroceryItem, patch: GroceryItemInput) => {
    const dbPatch = { name: patch.name.trim(), quantity: patch.quantity, category: patch.category };
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, ...dbPatch } : i)));
    const { error } = await supabase.from('grocery_items').update(dbPatch).eq('id', item.id);
    if (error) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      throw error;
    }
  }, []);

  const deleteItem = useCallback(async (item: GroceryItem) => {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const { error } = await supabase.from('grocery_items').delete().eq('id', item.id);
    if (error) {
      setItems((prev) => [...prev, item].sort((a, b) => a.created_at.localeCompare(b.created_at)));
      throw error;
    }
  }, []);

  const clearCheckedItems = useCallback(async () => {
    const checkedIds = items.filter((i) => i.is_checked).map((i) => i.id);
    if (checkedIds.length === 0) return;
    setItems((prev) => prev.filter((i) => !i.is_checked));
    const { error } = await supabase.from('grocery_items').delete().in('id', checkedIds);
    if (error) await load(); // couldn't reliably restore just the checked ones — reload from source of truth
  }, [items, load]);

  // Shared by "apply a saved list" and "add all staples" — skips anything
  // whose name already matches an item still unchecked on the active list,
  // so re-applying the same template twice doesn't spam duplicates.
  const addItemsToActiveList = useCallback(
    async (newItems: GroceryItemInput[]) => {
      if (!activeList) return 0;
      const existingNames = new Set(items.filter((i) => !i.is_checked).map((i) => i.name.trim().toLowerCase()));
      const seen = new Set<string>();
      const toInsert = newItems.filter((i) => {
        const key = i.name.trim().toLowerCase();
        if (!key || existingNames.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (toInsert.length === 0) return 0;

      const rows = toInsert.map((i) => ({
        list_id: activeList.id,
        name: i.name.trim(),
        quantity: i.quantity,
        category: i.category,
        created_by: currentUserId,
      }));
      const { data, error } = await supabase.from('grocery_items').insert(rows).select();
      if (error) throw error;
      setItems((prev) => [...prev, ...((data ?? []) as GroceryItem[])]);
      return toInsert.length;
    },
    [activeList, items, currentUserId]
  );

  const saveActiveListAsTemplate = useCallback(
    async (name: string) => {
      if (!household || !activeList) return;
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Give the list a name');

      const { data: template, error: templateError } = await supabase
        .from('grocery_lists')
        .insert({ household_id: household.id, name: trimmed, is_template: true, created_by: currentUserId })
        .select()
        .single();
      if (templateError) throw templateError;

      if (items.length > 0) {
        const rows = items.map((i) => ({
          list_id: template.id,
          name: i.name,
          quantity: i.quantity,
          category: i.category,
          created_by: currentUserId,
        }));
        const { error: itemsError } = await supabase.from('grocery_items').insert(rows);
        if (itemsError) throw itemsError;
      }

      await load();
    },
    [household, activeList, items, currentUserId, load]
  );

  const applyTemplate = useCallback(
    (template: TemplateWithItems) => {
      const input: GroceryItemInput[] = template.items.map((i) => ({ name: i.name, quantity: i.quantity, category: i.category }));
      return addItemsToActiveList(input);
    },
    [addItemsToActiveList]
  );

  // The reverse direction — merges whatever's currently on the active list
  // into an existing saved list, rather than replacing its contents.
  // Deliberately additive (not "overwrite") so it can't destroy a
  // template's other items by accident; dedupes the same way
  // addItemsToActiveList does.
  const addActiveListToTemplate = useCallback(
    async (template: TemplateWithItems) => {
      const existingNames = new Set(template.items.map((i) => i.name.trim().toLowerCase()));
      const seen = new Set<string>();
      const toInsert = items.filter((i) => {
        const key = i.name.trim().toLowerCase();
        if (!key || existingNames.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (toInsert.length === 0) return 0;

      const rows = toInsert.map((i) => ({
        list_id: template.id,
        name: i.name,
        quantity: i.quantity,
        category: i.category,
        created_by: currentUserId,
      }));
      const { data, error } = await supabase.from('grocery_items').insert(rows).select();
      if (error) throw error;
      const newItems = data as GroceryItem[];
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, items: [...t.items, ...newItems] } : t)));
      return toInsert.length;
    },
    [items, currentUserId]
  );

  const deleteTemplate = useCallback(
    async (template: GroceryList) => {
      setTemplates((prev) => prev.filter((t) => t.id !== template.id));
      const { error } = await supabase.from('grocery_lists').delete().eq('id', template.id);
      if (error) {
        await load();
        throw error;
      }
    },
    [load]
  );

  const renameTemplate = useCallback(async (template: GroceryList, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Give the list a name');
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, name: trimmed } : t)));
    const { error } = await supabase.from('grocery_lists').update({ name: trimmed }).eq('id', template.id);
    if (error) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, name: template.name } : t)));
      throw error;
    }
  }, []);

  // A saved template's items are edited directly (add/rename/remove)
  // rather than only ever being replaced by "save the active list again"
  // — these mirror addItem/updateItem/deleteItem above but write into the
  // template's own item list in local state instead of the active one.
  const addTemplateItem = useCallback(
    async (template: GroceryList, input: GroceryItemInput) => {
      const { data, error } = await supabase
        .from('grocery_items')
        .insert({
          list_id: template.id,
          name: input.name.trim(),
          quantity: input.quantity,
          category: input.category,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (error) throw error;
      const newItem = data as GroceryItem;
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, items: [...t.items, newItem] } : t)));
    },
    [currentUserId]
  );

  const updateTemplateItem = useCallback(async (template: GroceryList, item: GroceryItem, patch: GroceryItemInput) => {
    const dbPatch = { name: patch.name.trim(), quantity: patch.quantity, category: patch.category };
    setTemplates((prev) =>
      prev.map((t) => (t.id === template.id ? { ...t, items: t.items.map((i) => (i.id === item.id ? { ...i, ...dbPatch } : i)) } : t))
    );
    const { error } = await supabase.from('grocery_items').update(dbPatch).eq('id', item.id);
    if (error) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === template.id ? { ...t, items: t.items.map((i) => (i.id === item.id ? item : i)) } : t))
      );
      throw error;
    }
  }, []);

  const deleteTemplateItem = useCallback(async (template: GroceryList, item: GroceryItem) => {
    setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, items: t.items.filter((i) => i.id !== item.id) } : t)));
    const { error } = await supabase.from('grocery_items').delete().eq('id', item.id);
    if (error) {
      setTemplates((prev) => prev.map((t) => (t.id === template.id ? { ...t, items: [...t.items, item] } : t)));
      throw error;
    }
  }, []);

  const addStaple = useCallback(
    async (name: string, category: GroceryCategory) => {
      if (!household) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const { data, error } = await supabase
        .from('pantry_staples')
        .insert({ household_id: household.id, name: trimmed, category, created_by: currentUserId })
        .select()
        .single();
      if (error) throw error;
      setStaples((prev) => [...prev, data as PantryStaple]);
    },
    [household, currentUserId]
  );

  const deleteStaple = useCallback(async (staple: PantryStaple) => {
    setStaples((prev) => prev.filter((s) => s.id !== staple.id));
    const { error } = await supabase.from('pantry_staples').delete().eq('id', staple.id);
    if (error) {
      setStaples((prev) => [...prev, staple]);
      throw error;
    }
  }, []);

  const addAllStaplesToActiveList = useCallback(() => {
    const input: GroceryItemInput[] = staples.map((s) => ({ name: s.name, quantity: null, category: s.category }));
    return addItemsToActiveList(input);
  }, [staples, addItemsToActiveList]);

  return {
    loading,
    activeList,
    items,
    templates,
    staples,
    currentUserId,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
    clearCheckedItems,
    addItemsToActiveList,
    saveActiveListAsTemplate,
    applyTemplate,
    addActiveListToTemplate,
    deleteTemplate,
    renameTemplate,
    addTemplateItem,
    updateTemplateItem,
    deleteTemplateItem,
    addStaple,
    deleteStaple,
    addAllStaplesToActiveList,
    refresh: load,
  };
}
