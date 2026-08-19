import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { Checkbox } from '@/components/checkbox';
import { CollapsibleCard } from '@/components/collapsible-card';
import { GroceriesIcon } from '@/components/icons/section-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useGrocery } from '@/hooks/use-grocery';
import { useHousehold } from '@/hooks/use-household';
import { useRecipes } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { categoryEmoji, categoryLabel, GROCERY_CATEGORIES, groupByCategory } from '@/lib/grocery-format';
import { RECIPE_CATEGORIES, recipeCategoryLabel } from '@/lib/recipe-format';
import type { GroceryCategory, GroceryItem, GroceryList } from '@/types/grocery';
import type { Recipe, RecipeCategory } from '@/types/recipe';

type Mode = 'list' | 'recipes';
type TemplateWithItems = GroceryList & { items: GroceryItem[] };

type IngredientDraft = { name: string; quantity: string };

const EMPTY_INGREDIENT: IngredientDraft = { name: '', quantity: '' };

export function GroceriesSection({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const { members } = useHousehold();
  const grocery = useGrocery();
  const recipesHook = useRecipes();
  const { recipes, loading: recipesLoading } = recipesHook;

  const [mode, setMode] = useState<Mode>('list');

  // Item composer (doubles as the edit form when editingItemId is set)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemQuantity, setItemQuantity] = useState('');
  const [itemCategory, setItemCategory] = useState<GroceryCategory>('other');
  // Tracks whether the category came from an explicit tap vs. an
  // auto-suggestion — a manual pick is never overwritten, but further
  // auto-suggestions can keep following the name as it's edited right up
  // until the person actually taps a pill themselves.
  const [itemCategoryManual, setItemCategoryManual] = useState(false);
  const [itemComposerFocused, setItemComposerFocused] = useState(false);
  const itemComposerBlur = useDelayedBlur(setItemComposerFocused);
  const [addingItem, setAddingItem] = useState(false);
  const isItemComposerExpanded = itemComposerFocused || itemName.trim().length > 0 || editingItemId !== null;

  // Save-as-template
  const [templateNameDraft, setTemplateNameDraft] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Expanded template's own inline editor (only one open at a time)
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [templateRename, setTemplateRename] = useState('');
  const [savingTemplateRename, setSavingTemplateRename] = useState(false);
  const [editingTemplateItemId, setEditingTemplateItemId] = useState<string | null>(null);
  const [templateItemName, setTemplateItemName] = useState('');
  const [templateItemQuantity, setTemplateItemQuantity] = useState('');
  const [templateItemCategory, setTemplateItemCategory] = useState<GroceryCategory>('other');
  const [savingTemplateItem, setSavingTemplateItem] = useState(false);

  // Staples composer
  const [stapleName, setStapleName] = useState('');
  const [stapleCategory, setStapleCategory] = useState<GroceryCategory>('other');
  const [addingStaple, setAddingStaple] = useState(false);

  // Recipe composer / edit
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [recipeTitle, setRecipeTitle] = useState('');
  const [recipeServings, setRecipeServings] = useState('');
  const [recipeCategory, setRecipeCategory] = useState<RecipeCategory>('other');
  const [recipeInstructions, setRecipeInstructions] = useState('');
  const [ingredientDrafts, setIngredientDrafts] = useState<IngredientDraft[]>([EMPTY_INGREDIENT]);
  const [recipeComposerFocused, setRecipeComposerFocused] = useState(false);
  const recipeComposerBlur = useDelayedBlur(setRecipeComposerFocused);
  const [submittingRecipe, setSubmittingRecipe] = useState(false);
  const [expandedRecipeId, setExpandedRecipeId] = useState<string | null>(null);
  const [recipeCategoryFilter, setRecipeCategoryFilter] = useState<RecipeCategory | 'all'>('all');
  const isRecipeComposerExpanded = recipeComposerFocused || recipeTitle.trim().length > 0 || editingRecipeId !== null;

  const checkedCount = grocery.items.filter((i) => i.is_checked).length;
  const groupedItems = groupByCategory([...grocery.items].sort((a, b) => Number(a.is_checked) - Number(b.is_checked)));

  const usedRecipeCategories = RECIPE_CATEGORIES.filter((c) => recipes.some((r) => r.category === c.value));
  const visibleRecipes = recipeCategoryFilter === 'all' ? recipes : recipes.filter((r) => r.category === recipeCategoryFilter);

  function memberName(userId: string | null) {
    if (!userId) return null;
    if (userId === grocery.currentUserId) return 'you';
    return members.find((m) => m.user_id === userId)?.profile?.full_name?.trim() || null;
  }

  // A known name (an existing staple, or something already on the list)
  // suggests its category — but only ever fills in the still-untouched
  // default, never overrides a category the person picked themselves. An
  // exact match only (not fuzzy), so it never guesses wrong.
  function suggestCategoryForName(name: string): GroceryCategory | null {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const stapleMatch = grocery.staples.find((s) => s.name.trim().toLowerCase() === key);
    if (stapleMatch) return stapleMatch.category;
    const itemMatch = grocery.items.find((i) => i.name.trim().toLowerCase() === key);
    return itemMatch?.category ?? null;
  }

  function handleItemNameChange(text: string) {
    setItemName(text);
    if (!editingItemId && !itemCategoryManual) {
      const suggestion = suggestCategoryForName(text);
      setItemCategory(suggestion ?? 'other');
    }
  }

  function handleItemCategoryPick(category: GroceryCategory) {
    setItemCategory(category);
    setItemCategoryManual(true);
  }

  function resetItemForm() {
    setEditingItemId(null);
    setItemName('');
    setItemQuantity('');
    setItemCategory('other');
    setItemCategoryManual(false);
  }

  function startEditItem(item: GroceryItem) {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemQuantity(item.quantity ?? '');
    setItemCategory(item.category);
    setItemCategoryManual(true);
  }

  function resetRecipeForm() {
    setEditingRecipeId(null);
    setRecipeTitle('');
    setRecipeServings('');
    setRecipeCategory('other');
    setRecipeInstructions('');
    setIngredientDrafts([EMPTY_INGREDIENT]);
  }

  function startEditRecipe(recipe: Recipe) {
    setEditingRecipeId(recipe.id);
    setRecipeTitle(recipe.title);
    setRecipeServings(recipe.servings ? String(recipe.servings) : '');
    setRecipeCategory(recipe.category);
    setRecipeInstructions(recipe.instructions ?? '');
    setIngredientDrafts(
      recipe.ingredients && recipe.ingredients.length > 0
        ? recipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity ?? '' }))
        : [EMPTY_INGREDIENT]
    );
  }

  async function handleSubmitItem() {
    if (!itemName.trim()) return;
    setAddingItem(true);
    try {
      const input = { name: itemName, quantity: itemQuantity.trim() || null, category: itemCategory };
      if (editingItemId) {
        const item = grocery.items.find((i) => i.id === editingItemId);
        if (item) await grocery.updateItem(item, input);
      } else {
        await grocery.addItem(input);
      }
      resetItemForm();
    } catch (err) {
      showAlert(editingItemId ? "Couldn't save changes" : "Couldn't add item", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAddingItem(false);
    }
  }

  function handleToggleItem(item: GroceryItem) {
    grocery.toggleItem(item).catch((err) => {
      showAlert("Couldn't update item", err instanceof Error ? err.message : 'Something went wrong');
    });
  }

  function confirmDeleteItem(item: GroceryItem) {
    if (editingItemId === item.id) resetItemForm();
    grocery.deleteItem(item).catch((err) => {
      showAlert("Couldn't remove item", err instanceof Error ? err.message : 'Something went wrong');
    });
  }

  function confirmClearChecked() {
    showAlert('Clear checked items', `Remove ${checkedCount} checked ${checkedCount === 1 ? 'item' : 'items'} from the list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => grocery.clearCheckedItems() },
    ]);
  }

  async function handleSaveTemplate() {
    if (!templateNameDraft.trim()) return;
    setSavingTemplate(true);
    try {
      await grocery.saveActiveListAsTemplate(templateNameDraft);
      setTemplateNameDraft('');
    } catch (err) {
      showAlert("Couldn't save list", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleApplyTemplate(template: TemplateWithItems) {
    try {
      const added = await grocery.applyTemplate(template);
      showAlert(added > 0 ? `Added ${added} item${added === 1 ? '' : 's'}` : 'Already on your list', undefined);
    } catch (err) {
      showAlert("Couldn't add list", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function handleAddActiveListToTemplate(template: TemplateWithItems) {
    try {
      const added = await grocery.addActiveListToTemplate(template);
      showAlert(added > 0 ? `Added ${added} item${added === 1 ? '' : 's'} to "${template.name}"` : `Already on "${template.name}"`, undefined);
    } catch (err) {
      showAlert("Couldn't update list", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmDeleteTemplate(template: TemplateWithItems) {
    showAlert('Delete saved list', `Remove "${template.name}"? This won't affect your current list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (expandedTemplateId === template.id) setExpandedTemplateId(null);
          grocery.deleteTemplate(template).catch(() => showAlert("Couldn't delete list"));
        },
      },
    ]);
  }

  function toggleExpandTemplate(template: TemplateWithItems) {
    if (expandedTemplateId === template.id) {
      setExpandedTemplateId(null);
      return;
    }
    setExpandedTemplateId(template.id);
    setTemplateRename(template.name);
    setEditingTemplateItemId(null);
    setTemplateItemName('');
    setTemplateItemQuantity('');
    setTemplateItemCategory('other');
  }

  async function handleRenameTemplate(template: TemplateWithItems) {
    if (!templateRename.trim() || templateRename.trim() === template.name) return;
    setSavingTemplateRename(true);
    try {
      await grocery.renameTemplate(template, templateRename);
    } catch (err) {
      showAlert("Couldn't rename list", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingTemplateRename(false);
    }
  }

  function startEditTemplateItem(item: GroceryItem) {
    setEditingTemplateItemId(item.id);
    setTemplateItemName(item.name);
    setTemplateItemQuantity(item.quantity ?? '');
    setTemplateItemCategory(item.category);
  }

  function resetTemplateItemForm() {
    setEditingTemplateItemId(null);
    setTemplateItemName('');
    setTemplateItemQuantity('');
    setTemplateItemCategory('other');
  }

  async function handleSubmitTemplateItem(template: TemplateWithItems) {
    if (!templateItemName.trim()) return;
    setSavingTemplateItem(true);
    try {
      const input = { name: templateItemName, quantity: templateItemQuantity.trim() || null, category: templateItemCategory };
      if (editingTemplateItemId) {
        const item = template.items.find((i) => i.id === editingTemplateItemId);
        if (item) await grocery.updateTemplateItem(template, item, input);
      } else {
        await grocery.addTemplateItem(template, input);
      }
      resetTemplateItemForm();
    } catch (err) {
      showAlert("Couldn't update list", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSavingTemplateItem(false);
    }
  }

  function confirmDeleteTemplateItem(template: TemplateWithItems, item: GroceryItem) {
    if (editingTemplateItemId === item.id) resetTemplateItemForm();
    grocery.deleteTemplateItem(template, item).catch(() => showAlert("Couldn't remove item"));
  }

  async function handleAddStaple() {
    if (!stapleName.trim()) return;
    setAddingStaple(true);
    try {
      await grocery.addStaple(stapleName, stapleCategory);
      setStapleName('');
      setStapleCategory('other');
    } catch (err) {
      showAlert("Couldn't add staple", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setAddingStaple(false);
    }
  }

  async function handleAddAllStaples() {
    try {
      const added = await grocery.addAllStaplesToActiveList();
      showAlert(added > 0 ? `Added ${added} item${added === 1 ? '' : 's'}` : 'Already on your list', undefined);
    } catch (err) {
      showAlert("Couldn't add staples", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function updateIngredientDraft(index: number, patch: Partial<IngredientDraft>) {
    setIngredientDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function addIngredientRow() {
    setIngredientDrafts((prev) => [...prev, EMPTY_INGREDIENT]);
  }

  function removeIngredientRow(index: number) {
    setIngredientDrafts((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSubmitRecipe() {
    if (!recipeTitle.trim()) return;
    setSubmittingRecipe(true);
    try {
      const input = {
        title: recipeTitle,
        instructions: recipeInstructions || null,
        servings: recipeServings.trim() ? Number(recipeServings) : null,
        category: recipeCategory,
        ingredients: ingredientDrafts
          .filter((d) => d.name.trim())
          .map((d) => ({ name: d.name, quantity: d.quantity.trim() || null, category: null })),
      };
      if (editingRecipeId) {
        const recipe = recipes.find((r) => r.id === editingRecipeId);
        if (recipe) await recipesHook.updateRecipe(recipe, input);
      } else {
        await recipesHook.addRecipe(input);
      }
      resetRecipeForm();
    } catch (err) {
      showAlert(editingRecipeId ? "Couldn't save changes" : "Couldn't add recipe", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmittingRecipe(false);
    }
  }

  function confirmDeleteRecipe(recipe: Recipe) {
    showAlert('Delete recipe', `Remove "${recipe.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (editingRecipeId === recipe.id) resetRecipeForm();
          recipesHook.deleteRecipe(recipe).catch(() => showAlert("Couldn't delete recipe"));
        },
      },
    ]);
  }

  async function handleAddRecipeIngredientsToList(recipe: Recipe) {
    if (!recipe.ingredients || recipe.ingredients.length === 0) return;
    try {
      const added = await grocery.addItemsToActiveList(
        recipe.ingredients.map((i) => ({ name: i.name, quantity: i.quantity, category: i.category ?? 'other' }))
      );
      showAlert(added > 0 ? `Added ${added} item${added === 1 ? '' : 's'} to your list` : 'Already on your list', undefined);
    } catch (err) {
      showAlert("Couldn't add ingredients", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function renderCategoryPills(selected: GroceryCategory, onSelect: (c: GroceryCategory) => void) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {GROCERY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => onSelect(c.value)}
            style={[styles.pill, { backgroundColor: theme.backgroundSelected }, selected === c.value && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={selected === c.value ? 'background' : 'textSecondary'}>
              {c.emoji} {c.label}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={8}>
          <ThemedText type="linkPrimary">‹ Home</ThemedText>
        </Pressable>
        {mode === 'list' && checkedCount > 0 && (
          <Pressable onPress={confirmClearChecked} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Clear checked ({checkedCount})
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.modeRow}>
        {(['list', 'recipes'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.pill, styles.modePill, { backgroundColor: theme.backgroundSelected }, mode === m && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={mode === m ? 'background' : 'textSecondary'}>
              {m === 'list' ? 'Grocery List' : 'Recipes'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {mode === 'list' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Animated.View layout={LinearTransition.duration(200)}>
            <ThemedView type="backgroundElement" style={styles.addCard}>
              {editingItemId && (
                <View style={styles.editingRow}>
                  <ThemedText type="smallBold">Edit item</ThemedText>
                  <Pressable onPress={resetItemForm} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      Cancel
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Add an item…"
                placeholderTextColor={theme.textSecondary}
                value={itemName}
                onChangeText={handleItemNameChange}
                onSubmitEditing={handleSubmitItem}
                onFocus={itemComposerBlur.onFocus}
                onBlur={itemComposerBlur.onBlur}
                returnKeyType="done"
              />
              {isItemComposerExpanded && (
                <>
                  {renderCategoryPills(itemCategory, handleItemCategoryPick)}
                  <TextInput
                    style={[styles.input, styles.quantityInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Quantity (optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={itemQuantity}
                    onChangeText={setItemQuantity}
                  />
                  <Pressable
                    style={[styles.addButton, { backgroundColor: theme.accent, opacity: itemName.trim() && !addingItem ? 1 : 0.5 }]}
                    disabled={!itemName.trim() || addingItem}
                    onPress={handleSubmitItem}>
                    {addingItem ? (
                      <ActivityIndicator color={theme.background} />
                    ) : (
                      <ThemedText type="smallBold" themeColor="background">
                        {editingItemId ? 'Save changes' : 'Add'}
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              )}
            </ThemedView>
          </Animated.View>

          {grocery.loading && grocery.items.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

          {!grocery.loading && grocery.items.length === 0 && (
            <View style={styles.emptyState}>
              <GroceriesIcon color={theme.backgroundSelected} size={40} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No items yet — add your first one above.
              </ThemedText>
            </View>
          )}

          {groupedItems.map(({ category, items }) => (
            <View key={category} style={styles.categoryGroup}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.categoryHeader}>
                {categoryEmoji(category)} {categoryLabel(category).toUpperCase()}
              </ThemedText>
              {items.map((item) => {
                const checkedByName = item.is_checked ? memberName(item.checked_by) : null;
                return (
                  <Animated.View key={item.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(200)}>
                    <ThemedView
                      type="backgroundElement"
                      style={[styles.itemRow, editingItemId === item.id && { borderColor: theme.accent, borderWidth: 1 }]}
                      testID={`grocery-item-${item.id}`}>
                      <Checkbox checked={item.is_checked} onToggle={() => handleToggleItem(item)} testID={`grocery-checkbox-${item.id}`} />
                      <Pressable style={styles.itemTextWrapper} onPress={() => startEditItem(item)}>
                        <ThemedText
                          type="default"
                          themeColor={item.is_checked ? 'textSecondary' : 'text'}
                          style={item.is_checked && styles.doneText}>
                          {item.name}
                        </ThemedText>
                        {(!!item.quantity || checkedByName) && (
                          <ThemedText type="small" themeColor="textSecondary">
                            {item.quantity}
                            {item.quantity && checkedByName ? ' · ' : ''}
                            {checkedByName ? `Checked by ${checkedByName}` : ''}
                          </ThemedText>
                        )}
                      </Pressable>
                      <Pressable onPress={() => confirmDeleteItem(item)} hitSlop={8} testID={`grocery-delete-${item.id}`}>
                        <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </ThemedView>
                  </Animated.View>
                );
              })}
            </View>
          ))}

          <CollapsibleCard title="SAVED LISTS">
            <View style={styles.saveTemplateRow}>
              <TextInput
                style={[styles.input, styles.saveTemplateInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder="Name this list…"
                placeholderTextColor={theme.textSecondary}
                value={templateNameDraft}
                onChangeText={setTemplateNameDraft}
              />
              <Pressable
                disabled={!templateNameDraft.trim() || savingTemplate || grocery.items.length === 0}
                onPress={handleSaveTemplate}
                hitSlop={8}>
                <ThemedText
                  type="smallBold"
                  themeColor={templateNameDraft.trim() && grocery.items.length > 0 ? 'accent' : 'textSecondary'}>
                  {savingTemplate ? '…' : 'Save'}
                </ThemedText>
              </Pressable>
            </View>

            {grocery.templates.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No saved lists yet — save your current list above to reuse it later.
              </ThemedText>
            ) : (
              grocery.templates.map((template) => {
                const isExpanded = expandedTemplateId === template.id;
                return (
                  <View key={template.id}>
                    <View style={styles.templateRow}>
                      <Pressable style={styles.templateNameColumn} onPress={() => toggleExpandTemplate(template)}>
                        <ThemedText type="small">{template.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          {template.items.length} {template.items.length === 1 ? 'item' : 'items'}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleApplyTemplate(template)} hitSlop={8}>
                        <ThemedView type="backgroundSelected" style={styles.useButton}>
                          <ThemedText type="small">Use</ThemedText>
                        </ThemedView>
                      </Pressable>
                      <Pressable onPress={() => confirmDeleteTemplate(template)} hitSlop={8}>
                        <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </View>

                    {isExpanded && (
                      <View style={styles.templateEditor}>
                        <View style={styles.saveTemplateRow}>
                          <TextInput
                            style={[styles.input, styles.saveTemplateInput, { color: theme.text, backgroundColor: theme.background }]}
                            value={templateRename}
                            onChangeText={setTemplateRename}
                          />
                          <Pressable
                            disabled={!templateRename.trim() || templateRename.trim() === template.name || savingTemplateRename}
                            onPress={() => handleRenameTemplate(template)}
                            hitSlop={8}>
                            <ThemedText type="smallBold" themeColor="accent">
                              {savingTemplateRename ? '…' : 'Rename'}
                            </ThemedText>
                          </Pressable>
                        </View>

                        {grocery.items.length > 0 && (
                          <Pressable onPress={() => handleAddActiveListToTemplate(template)} style={({ pressed }) => pressed && styles.pressed}>
                            <ThemedView type="background" style={styles.addCurrentListButton}>
                              <ThemedText type="small">+ Add current list&apos;s items to this list</ThemedText>
                            </ThemedView>
                          </Pressable>
                        )}

                        {template.items.map((item) => (
                          <View key={item.id} style={styles.templateRow}>
                            <Pressable style={styles.templateNameColumn} onPress={() => startEditTemplateItem(item)}>
                              <ThemedText type="small">
                                {categoryEmoji(item.category)} {item.name}
                                {item.quantity ? ` — ${item.quantity}` : ''}
                              </ThemedText>
                            </Pressable>
                            <Pressable onPress={() => confirmDeleteTemplateItem(template, item)} hitSlop={8}>
                              <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                                ×
                              </ThemedText>
                            </Pressable>
                          </View>
                        ))}

                        <View style={styles.editingRow}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {editingTemplateItemId ? 'Edit item' : 'Add item'}
                          </ThemedText>
                          {editingTemplateItemId && (
                            <Pressable onPress={resetTemplateItemForm} hitSlop={8}>
                              <ThemedText type="small" themeColor="accent">
                                Cancel
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                        <TextInput
                          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                          placeholder="Item name"
                          placeholderTextColor={theme.textSecondary}
                          value={templateItemName}
                          onChangeText={setTemplateItemName}
                        />
                        {renderCategoryPills(templateItemCategory, setTemplateItemCategory)}
                        <TextInput
                          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                          placeholder="Quantity (optional)"
                          placeholderTextColor={theme.textSecondary}
                          value={templateItemQuantity}
                          onChangeText={setTemplateItemQuantity}
                        />
                        <Pressable
                          style={[
                            styles.addButton,
                            { backgroundColor: theme.accent, opacity: templateItemName.trim() && !savingTemplateItem ? 1 : 0.5 },
                          ]}
                          disabled={!templateItemName.trim() || savingTemplateItem}
                          onPress={() => handleSubmitTemplateItem(template)}>
                          <ThemedText type="smallBold" themeColor="background">
                            {editingTemplateItemId ? 'Save changes' : 'Add item'}
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </CollapsibleCard>

          <CollapsibleCard title="STAPLES">
            <Pressable
              disabled={grocery.staples.length === 0}
              onPress={handleAddAllStaples}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type="backgroundSelected"
                style={[styles.addButton, grocery.staples.length === 0 && styles.saveButtonDisabled]}>
                <ThemedText type="smallBold">Add all staples to list</ThemedText>
              </ThemedView>
            </Pressable>

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder="Add a staple (milk, eggs…)"
              placeholderTextColor={theme.textSecondary}
              value={stapleName}
              onChangeText={setStapleName}
              onSubmitEditing={handleAddStaple}
              returnKeyType="done"
            />
            {stapleName.trim().length > 0 && (
              <>
                {renderCategoryPills(stapleCategory, setStapleCategory)}
                <Pressable
                  style={[styles.addButton, { backgroundColor: theme.accent, opacity: addingStaple ? 0.6 : 1 }]}
                  disabled={addingStaple}
                  onPress={handleAddStaple}>
                  <ThemedText type="smallBold" themeColor="background">
                    Add staple
                  </ThemedText>
                </Pressable>
              </>
            )}

            {grocery.staples.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                No staples yet — add items you always need.
              </ThemedText>
            ) : (
              grocery.staples.map((staple) => (
                <View key={staple.id} style={styles.templateRow}>
                  <ThemedText type="small" style={styles.templateNameColumn}>
                    {categoryEmoji(staple.category)} {staple.name}
                  </ThemedText>
                  <Pressable onPress={() => grocery.deleteStaple(staple).catch(() => showAlert("Couldn't remove staple"))} hitSlop={8}>
                    <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </CollapsibleCard>
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Animated.View layout={LinearTransition.duration(200)}>
            <ThemedView type="backgroundElement" style={styles.addCard}>
              {editingRecipeId && (
                <View style={styles.editingRow}>
                  <ThemedText type="smallBold">Edit recipe</ThemedText>
                  <Pressable onPress={resetRecipeForm} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      Cancel
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder="Recipe title…"
                placeholderTextColor={theme.textSecondary}
                value={recipeTitle}
                onChangeText={setRecipeTitle}
                onFocus={recipeComposerBlur.onFocus}
                onBlur={recipeComposerBlur.onBlur}
              />

              {isRecipeComposerExpanded && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
                    {RECIPE_CATEGORIES.map((c) => (
                      <Pressable
                        key={c.value}
                        onPress={() => setRecipeCategory(c.value)}
                        style={[
                          styles.pill,
                          { backgroundColor: theme.backgroundSelected },
                          recipeCategory === c.value && { backgroundColor: theme.accent },
                        ]}>
                        <ThemedText type="small" themeColor={recipeCategory === c.value ? 'background' : 'textSecondary'}>
                          {c.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Servings (optional)"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={recipeServings}
                    onChangeText={setRecipeServings}
                  />

                  <ThemedText type="small" themeColor="textSecondary">
                    Ingredients
                  </ThemedText>
                  {ingredientDrafts.map((draft, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <TextInput
                        style={[styles.input, styles.ingredientNameInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                        placeholder="Ingredient"
                        placeholderTextColor={theme.textSecondary}
                        value={draft.name}
                        onChangeText={(text) => updateIngredientDraft(index, { name: text })}
                      />
                      <TextInput
                        style={[styles.input, styles.ingredientQuantityInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                        placeholder="Qty"
                        placeholderTextColor={theme.textSecondary}
                        value={draft.quantity}
                        onChangeText={(text) => updateIngredientDraft(index, { quantity: text })}
                      />
                      <Pressable onPress={() => removeIngredientRow(index)} hitSlop={8}>
                        <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPress={addIngredientRow} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      + Add ingredient
                    </ThemedText>
                  </Pressable>

                  <TextInput
                    style={[styles.input, styles.instructionsInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder="Instructions (optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={recipeInstructions}
                    onChangeText={setRecipeInstructions}
                    multiline
                  />

                  <Pressable
                    style={[styles.addButton, { backgroundColor: theme.accent, opacity: recipeTitle.trim() && !submittingRecipe ? 1 : 0.5 }]}
                    disabled={!recipeTitle.trim() || submittingRecipe}
                    onPress={handleSubmitRecipe}>
                    {submittingRecipe ? (
                      <ActivityIndicator color={theme.background} />
                    ) : (
                      <ThemedText type="smallBold" themeColor="background">
                        {editingRecipeId ? 'Save changes' : 'Add recipe'}
                      </ThemedText>
                    )}
                  </Pressable>
                </>
              )}
            </ThemedView>
          </Animated.View>

          {recipes.length > 1 && usedRecipeCategories.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
              <Pressable
                onPress={() => setRecipeCategoryFilter('all')}
                style={[
                  styles.pill,
                  { backgroundColor: theme.backgroundSelected },
                  recipeCategoryFilter === 'all' && { backgroundColor: theme.accent },
                ]}>
                <ThemedText type="small" themeColor={recipeCategoryFilter === 'all' ? 'background' : 'textSecondary'}>
                  All
                </ThemedText>
              </Pressable>
              {usedRecipeCategories.map((c) => (
                <Pressable
                  key={c.value}
                  onPress={() => setRecipeCategoryFilter(c.value)}
                  style={[
                    styles.pill,
                    { backgroundColor: theme.backgroundSelected },
                    recipeCategoryFilter === c.value && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText type="small" themeColor={recipeCategoryFilter === c.value ? 'background' : 'textSecondary'}>
                    {c.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          {recipesLoading && recipes.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

          {!recipesLoading && recipes.length === 0 && (
            <View style={styles.emptyState}>
              <GroceriesIcon color={theme.backgroundSelected} size={40} />
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                No recipes yet — add your first one above.
              </ThemedText>
            </View>
          )}

          {visibleRecipes.map((recipe) => {
            const isExpanded = expandedRecipeId === recipe.id;
            return (
              <ThemedView key={recipe.id} type="backgroundElement" style={styles.recipeCard}>
                <Pressable onPress={() => setExpandedRecipeId(isExpanded ? null : recipe.id)}>
                  <View style={styles.recipeHeaderRow}>
                    <View style={styles.templateNameColumn}>
                      <ThemedText type="default">{recipe.title}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {recipeCategoryLabel(recipe.category)}
                        {recipe.servings ? ` · Serves ${recipe.servings}` : ''}
                      </ThemedText>
                    </View>
                    <ThemedText themeColor="textSecondary" style={styles.chevron}>
                      {isExpanded ? '⌄' : '›'}
                    </ThemedText>
                  </View>
                </Pressable>

                {isExpanded && (
                  <View style={styles.recipeDetails}>
                    {(recipe.ingredients ?? []).map((ingredient) => (
                      <ThemedText key={ingredient.id} type="small" themeColor="textSecondary">
                        • {ingredient.quantity ? `${ingredient.quantity} ` : ''}
                        {ingredient.name}
                      </ThemedText>
                    ))}
                    {!!recipe.instructions && (
                      <ThemedText type="small" style={styles.instructionsText}>
                        {recipe.instructions}
                      </ThemedText>
                    )}
                    <View style={styles.recipeActionsRow}>
                      <Pressable onPress={() => handleAddRecipeIngredientsToList(recipe)} hitSlop={8}>
                        <ThemedView type="backgroundSelected" style={styles.useButton}>
                          <ThemedText type="small">Add to list</ThemedText>
                        </ThemedView>
                      </Pressable>
                      <Pressable onPress={() => startEditRecipe(recipe)} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          Edit
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => confirmDeleteRecipe(recipe)} hitSlop={8}>
                        <ThemedText type="small" style={styles.deleteText}>
                          Delete
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ThemedView>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignSelf: 'stretch', gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeRow: { flexDirection: 'row', gap: Spacing.two },
  modePill: { flex: 1, alignItems: 'center' },
  addCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  quantityInput: { marginTop: Spacing.one },
  pillRow: { flexGrow: 0 },
  pill: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999, marginRight: Spacing.two },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two, marginTop: Spacing.one },
  saveButtonDisabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  list: { flex: 1 },
  listContent: { gap: Spacing.three, paddingBottom: Spacing.four },
  categoryGroup: { gap: Spacing.two },
  categoryHeader: { paddingHorizontal: Spacing.one },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  itemTextWrapper: { flex: 1, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 20, lineHeight: 20, paddingHorizontal: Spacing.one },
  deleteText: { color: '#e5484d' },
  saveTemplateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  saveTemplateInput: { flex: 1 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  templateNameColumn: { flex: 1, gap: Spacing.half },
  templateEditor: { gap: Spacing.two, paddingLeft: Spacing.three, marginTop: Spacing.one, marginBottom: Spacing.two },
  addCurrentListButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  useButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  ingredientNameInput: { flex: 2 },
  ingredientQuantityInput: { flex: 1 },
  instructionsInput: { minHeight: 80, textAlignVertical: 'top' },
  recipeCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  recipeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 20, lineHeight: 20 },
  recipeDetails: { gap: Spacing.two, marginTop: Spacing.one },
  instructionsText: { marginTop: Spacing.one },
  recipeActionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, marginTop: Spacing.one },
});
