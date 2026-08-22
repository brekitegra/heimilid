import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';

import { BackButton } from '@/components/back-button';
import { Checkbox } from '@/components/checkbox';
import { CollapsibleCard } from '@/components/collapsible-card';
import { GroceriesIcon } from '@/components/icons/section-icons';
import { NavArrowButton } from '@/components/nav-arrow-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatMonthDay } from '@/lib/date-locale';
import { startOfWeek, toLocalISODate } from '@/lib/date-format';
import { useDelayedBlur } from '@/hooks/use-delayed-blur';
import { useGrocery } from '@/hooks/use-grocery';
import { useHousehold } from '@/hooks/use-household';
import { useLanguage, useTranslation, type TranslationKey } from '@/hooks/use-language';
import { useMealPlans } from '@/hooks/use-meal-plans';
import { useRecipes } from '@/hooks/use-recipes';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { isSameName } from '@/lib/duplicate-check';
import { categoryEmoji, GROCERY_CATEGORIES, groupByCategory } from '@/lib/grocery-format';
import { sanitizeNumericInput } from '@/lib/number-format';
import { RECIPE_CATEGORIES } from '@/lib/recipe-format';
import type { GroceryCategory, GroceryItem, GroceryList } from '@/types/grocery';
import type { MealPlan } from '@/types/meal-plan';
import type { Recipe, RecipeCategory } from '@/types/recipe';

type Mode = 'list' | 'recipes' | 'plan';
type TemplateWithItems = GroceryList & { items: GroceryItem[] };

type IngredientDraft = { name: string; quantity: string };

const EMPTY_INGREDIENT: IngredientDraft = { name: '', quantity: '' };

const WEEKDAY_KEYS: TranslationKey[] = [
  'weekdayMonday',
  'weekdayTuesday',
  'weekdayWednesday',
  'weekdayThursday',
  'weekdayFriday',
  'weekdaySaturday',
  'weekdaySunday',
];

const GROCERY_CATEGORY_KEY: Record<GroceryCategory, TranslationKey> = {
  produce: 'groceryCategoryProduce',
  dairy: 'groceryCategoryDairy',
  meat: 'groceryCategoryMeat',
  bakery: 'groceryCategoryBakery',
  frozen: 'groceryCategoryFrozen',
  pantry: 'groceryCategoryPantry',
  beverages: 'groceryCategoryBeverages',
  household: 'groceryCategoryHousehold',
  pets: 'groceryCategoryPets',
  other: 'groceryCategoryOther',
};

const RECIPE_CATEGORY_KEY: Record<RecipeCategory, TranslationKey> = {
  breakfast: 'recipeCategoryBreakfast',
  lunch: 'recipeCategoryLunch',
  dinner: 'recipeCategoryDinner',
  dessert: 'recipeCategoryDessert',
  snack: 'recipeCategorySnack',
  other: 'recipeCategoryOther',
};

export function GroceriesSection({ onBack }: { onBack: () => void }) {
  const t = useTranslation();
  const { language } = useLanguage();
  const theme = useTheme();
  const { members } = useHousehold();
  const grocery = useGrocery();
  const recipesHook = useRecipes();
  const { recipes, loading: recipesLoading } = recipesHook;
  const mealPlans = useMealPlans();

  const [mode, setMode] = useState<Mode>('list');

  // Weekly dinner plan
  const [planWeekStart, setPlanWeekStart] = useState(() => startOfWeek(new Date()));
  const [mealComposerDate, setMealComposerDate] = useState<string | null>(null);
  const [mealPickMode, setMealPickMode] = useState<'recipe' | 'custom'>('recipe');
  const [mealCustomTitle, setMealCustomTitle] = useState('');
  const [mealSubmitting, setMealSubmitting] = useState(false);
  const [addingWeekIngredients, setAddingWeekIngredients] = useState(false);

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

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(planWeekStart);
    d.setDate(d.getDate() + i);
    return toLocalISODate(d);
  });
  const plansByDate = new Map(mealPlans.plans.map((p) => [p.plan_date, p]));
  const weekLabel = (() => {
    const start = new Date(`${weekDates[0]}T00:00:00`);
    const end = new Date(`${weekDates[6]}T00:00:00`);
    const fmt = (d: Date) => formatMonthDay(d, language);
    return `${fmt(start)} – ${fmt(end)}`;
  })();

  function memberName(userId: string | null) {
    if (!userId) return null;
    if (userId === grocery.currentUserId) return t('you');
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
    const duplicate = grocery.items.find((i) => i.id !== editingItemId && !i.is_checked && isSameName(i.name, itemName));
    if (duplicate) {
      showAlert(t('groceryDuplicateTitle'), t('groceryDuplicateMessage', { name: duplicate.name }));
      return;
    }
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
      showAlert(
        editingItemId ? t('grocerySaveErrorTitle') : t('groceryAddItemErrorTitle'),
        err instanceof Error ? err.message : t('genericErrorMessage')
      );
    } finally {
      setAddingItem(false);
    }
  }

  function handleToggleItem(item: GroceryItem) {
    grocery.toggleItem(item).catch((err) => {
      showAlert(t('groceryUpdateItemErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    });
  }

  function confirmDeleteItem(item: GroceryItem) {
    if (editingItemId === item.id) resetItemForm();
    grocery.deleteItem(item).catch((err) => {
      showAlert(t('groceryRemoveItemErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    });
  }

  function confirmClearChecked() {
    showAlert(
      t('groceryClearCheckedConfirmTitle'),
      t(checkedCount === 1 ? 'groceryClearCheckedConfirmMessageOne' : 'groceryClearCheckedConfirmMessageOther', { count: checkedCount }),
      [
        { text: t('cancel'), style: 'cancel' },
        { text: t('clear'), style: 'destructive', onPress: () => grocery.clearCheckedItems() },
      ]
    );
  }

  async function handleSaveTemplate() {
    if (!templateNameDraft.trim()) return;
    setSavingTemplate(true);
    try {
      await grocery.saveActiveListAsTemplate(templateNameDraft);
      setTemplateNameDraft('');
    } catch (err) {
      showAlert(t('groceryTemplateSaveErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingTemplate(false);
    }
  }

  async function handleApplyTemplate(template: TemplateWithItems) {
    try {
      const added = await grocery.applyTemplate(template);
      showAlert(added > 0 ? t(added === 1 ? 'groceryItemsAddedMessageOne' : 'groceryItemsAddedMessageOther', { count: added }) : t('groceryDuplicateTitle'), undefined);
    } catch (err) {
      showAlert(t('groceryTemplateApplyErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  async function handleAddActiveListToTemplate(template: TemplateWithItems) {
    try {
      const added = await grocery.addActiveListToTemplate(template);
      showAlert(
        added > 0
          ? t('groceryItemsAddedToTemplateMessage', { count: added, name: template.name })
          : t('groceryAlreadyOnTemplateMessage', { name: template.name }),
        undefined
      );
    } catch (err) {
      showAlert(t('groceryTemplateUpdateErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  function confirmDeleteTemplate(template: TemplateWithItems) {
    showAlert(t('groceryDeleteTemplateConfirmTitle'), t('groceryDeleteTemplateConfirmMessage', { name: template.name }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (expandedTemplateId === template.id) setExpandedTemplateId(null);
          grocery.deleteTemplate(template).catch(() => showAlert(t('groceryDeleteTemplateErrorTitle')));
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
      showAlert(t('groceryRenameTemplateErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
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
      showAlert(t('groceryTemplateUpdateErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingTemplateItem(false);
    }
  }

  function confirmDeleteTemplateItem(template: TemplateWithItems, item: GroceryItem) {
    if (editingTemplateItemId === item.id) resetTemplateItemForm();
    grocery.deleteTemplateItem(template, item).catch(() => showAlert(t('groceryRemoveItemErrorTitle')));
  }

  async function handleAddStaple() {
    if (!stapleName.trim()) return;
    setAddingStaple(true);
    try {
      await grocery.addStaple(stapleName, stapleCategory);
      setStapleName('');
      setStapleCategory('other');
    } catch (err) {
      showAlert(t('groceryAddStapleErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setAddingStaple(false);
    }
  }

  async function handleAddAllStaples() {
    try {
      const added = await grocery.addAllStaplesToActiveList();
      showAlert(added > 0 ? t(added === 1 ? 'groceryItemsAddedMessageOne' : 'groceryItemsAddedMessageOther', { count: added }) : t('groceryDuplicateTitle'), undefined);
    } catch (err) {
      showAlert(t('groceryAddStaplesErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
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
      showAlert(
        editingRecipeId ? t('recipeSaveErrorTitle') : t('recipeAddErrorTitle'),
        err instanceof Error ? err.message : t('genericErrorMessage')
      );
    } finally {
      setSubmittingRecipe(false);
    }
  }

  function confirmDeleteRecipe(recipe: Recipe) {
    showAlert(t('recipeDeleteConfirmTitle'), t('recipeDeleteConfirmMessage', { title: recipe.title }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (editingRecipeId === recipe.id) resetRecipeForm();
          recipesHook.deleteRecipe(recipe).catch(() => showAlert(t('recipeDeleteErrorTitle')));
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
      showAlert(added > 0 ? t(added === 1 ? 'groceryIngredientsAddedMessageOne' : 'groceryIngredientsAddedMessageOther', { count: added }) : t('groceryDuplicateTitle'), undefined);
    } catch (err) {
      showAlert(t('groceryAddIngredientsErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  // --- Weekly dinner plan ---

  function goToPreviousWeek() {
    const d = new Date(planWeekStart);
    d.setDate(d.getDate() - 7);
    setPlanWeekStart(d);
  }

  function goToNextWeek() {
    const d = new Date(planWeekStart);
    d.setDate(d.getDate() + 7);
    setPlanWeekStart(d);
  }

  function openMealComposer(dateIso: string) {
    setMealComposerDate(dateIso);
    setMealPickMode('recipe');
    setMealCustomTitle('');
  }

  function closeMealComposer() {
    setMealComposerDate(null);
    setMealCustomTitle('');
  }

  async function handlePickRecipeForMeal(recipe: Recipe) {
    if (!mealComposerDate) return;
    setMealSubmitting(true);
    try {
      await mealPlans.setMeal({ planDate: mealComposerDate, recipeId: recipe.id, title: null });
      closeMealComposer();
    } catch (err) {
      showAlert(t('mealPlanSaveErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setMealSubmitting(false);
    }
  }

  async function handleSaveCustomMeal() {
    if (!mealComposerDate || !mealCustomTitle.trim()) return;
    setMealSubmitting(true);
    try {
      await mealPlans.setMeal({ planDate: mealComposerDate, recipeId: null, title: mealCustomTitle.trim() });
      closeMealComposer();
    } catch (err) {
      showAlert(t('mealPlanSaveErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setMealSubmitting(false);
    }
  }

  function confirmClearMeal(plan: MealPlan) {
    showAlert(t('mealPlanClearConfirmTitle'), t('mealPlanClearConfirmMessage'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: () => {
          if (mealComposerDate === plan.plan_date) closeMealComposer();
          mealPlans.clearMeal(plan).catch(() => showAlert(t('mealPlanClearErrorTitle')));
        },
      },
    ]);
  }

  async function handleAddWeekIngredients() {
    const weekPlans = weekDates.map((d) => plansByDate.get(d)).filter((p): p is MealPlan => !!p && !!p.recipe_id);
    const weekIngredients = weekPlans.flatMap((plan) => {
      const recipe = recipes.find((r) => r.id === plan.recipe_id);
      return (recipe?.ingredients ?? []).map((i) => ({ name: i.name, quantity: i.quantity, category: i.category ?? 'other' }));
    });
    if (weekIngredients.length === 0) {
      showAlert(t('mealPlanNothingToAddTitle'), t('mealPlanNothingToAddMessage'));
      return;
    }
    setAddingWeekIngredients(true);
    try {
      const added = await grocery.addItemsToActiveList(weekIngredients);
      showAlert(added > 0 ? t(added === 1 ? 'groceryIngredientsAddedMessageOne' : 'groceryIngredientsAddedMessageOther', { count: added }) : t('groceryDuplicateTitle'), undefined);
    } catch (err) {
      showAlert(t('groceryAddIngredientsErrorTitle'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setAddingWeekIngredients(false);
    }
  }

  function renderCategoryPills(selected: GroceryCategory, onSelect: (c: GroceryCategory) => void, onPressIn?: () => void) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillRow}>
        {GROCERY_CATEGORIES.map((c) => (
          <Pressable
            key={c.value}
            onPressIn={onPressIn}
            onPress={() => onSelect(c.value)}
            style={[styles.pill, { backgroundColor: theme.backgroundSelected }, selected === c.value && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={selected === c.value ? 'background' : 'textSecondary'}>
              {c.emoji} {t(GROCERY_CATEGORY_KEY[c.value] ?? 'groceryCategoryOther')}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <BackButton label={t('home')} onPress={onBack} />
        {mode === 'list' && checkedCount > 0 && (
          <Pressable onPress={confirmClearChecked} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('groceryClearChecked', { count: checkedCount })}
            </ThemedText>
          </Pressable>
        )}
      </View>

      <View style={styles.modeRow}>
        {(['list', 'recipes', 'plan'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={[styles.pill, styles.modePill, { backgroundColor: theme.backgroundSelected }, mode === m && { backgroundColor: theme.accent }]}>
            <ThemedText type="small" themeColor={mode === m ? 'background' : 'textSecondary'}>
              {m === 'list' ? t('groceryModeList') : m === 'recipes' ? t('groceryModeRecipes') : t('groceryModePlan')}
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
                  <ThemedText type="smallBold">{t('groceryEditItemHeading')}</ThemedText>
                  <Pressable onPress={resetItemForm} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      {t('cancel')}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('groceryAddItemPlaceholder')}
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
                  {renderCategoryPills(itemCategory, handleItemCategoryPick, itemComposerBlur.onFocus)}
                  <TextInput
                    style={[styles.input, styles.quantityInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('groceryQuantityPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={itemQuantity}
                    onChangeText={setItemQuantity}
                    onFocus={itemComposerBlur.onFocus}
                    onBlur={itemComposerBlur.onBlur}
                  />
                  <Pressable
                    style={[styles.addButton, { backgroundColor: theme.accent, opacity: itemName.trim() && !addingItem ? 1 : 0.5 }]}
                    disabled={!itemName.trim() || addingItem}
                    onPress={handleSubmitItem}>
                    {addingItem ? (
                      <ActivityIndicator color={theme.background} />
                    ) : (
                      <ThemedText type="smallBold" themeColor="background">
                        {editingItemId ? t('saveChanges') : t('add')}
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
                {t('groceryEmptyState')}
              </ThemedText>
            </View>
          )}

          {groupedItems.map(({ category, items }) => (
            <View key={category} style={styles.categoryGroup}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.categoryHeader}>
                {categoryEmoji(category)} {t(GROCERY_CATEGORY_KEY[category] ?? 'groceryCategoryOther').toUpperCase()}
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
                            {checkedByName ? t('groceryCheckedBy', { name: checkedByName }) : ''}
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

          <CollapsibleCard title={t('grocerySavedListsHeading')}>
            <View style={styles.saveTemplateRow}>
              <TextInput
                style={[styles.input, styles.saveTemplateInput, { color: theme.text, backgroundColor: theme.background }]}
                placeholder={t('groceryTemplateNamePlaceholder')}
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
                  {savingTemplate ? '…' : t('save')}
                </ThemedText>
              </Pressable>
            </View>

            {grocery.templates.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('groceryTemplatesEmptyState')}
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
                          {t(template.items.length === 1 ? 'groceryItemCountOne' : 'groceryItemCountOther', { count: template.items.length })}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => handleApplyTemplate(template)} hitSlop={8}>
                        <ThemedView type="backgroundSelected" style={styles.useButton}>
                          <ThemedText type="small">{t('groceryUseTemplate')}</ThemedText>
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
                              {savingTemplateRename ? '…' : t('groceryRenameTemplate')}
                            </ThemedText>
                          </Pressable>
                        </View>

                        {grocery.items.length > 0 && (
                          <Pressable onPress={() => handleAddActiveListToTemplate(template)} style={({ pressed }) => pressed && styles.pressed}>
                            <ThemedView type="background" style={styles.addCurrentListButton}>
                              <ThemedText type="small">{t('groceryAddCurrentListToTemplate')}</ThemedText>
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
                            {editingTemplateItemId ? t('groceryEditItemHeading') : t('groceryAddItemHeading')}
                          </ThemedText>
                          {editingTemplateItemId && (
                            <Pressable onPress={resetTemplateItemForm} hitSlop={8}>
                              <ThemedText type="small" themeColor="accent">
                                {t('cancel')}
                              </ThemedText>
                            </Pressable>
                          )}
                        </View>
                        <TextInput
                          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                          placeholder={t('groceryItemNamePlaceholder')}
                          placeholderTextColor={theme.textSecondary}
                          value={templateItemName}
                          onChangeText={setTemplateItemName}
                        />
                        {renderCategoryPills(templateItemCategory, setTemplateItemCategory)}
                        <TextInput
                          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                          placeholder={t('groceryQuantityPlaceholder')}
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
                            {editingTemplateItemId ? t('saveChanges') : t('groceryAddItemHeading')}
                          </ThemedText>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </CollapsibleCard>

          <CollapsibleCard title={t('groceryStaplesHeading')}>
            <Pressable
              disabled={grocery.staples.length === 0}
              onPress={handleAddAllStaples}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView
                type="backgroundSelected"
                style={[styles.addButton, grocery.staples.length === 0 && styles.saveButtonDisabled]}>
                <ThemedText type="smallBold">{t('groceryAddAllStaples')}</ThemedText>
              </ThemedView>
            </Pressable>

            <TextInput
              style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
              placeholder={t('groceryStaplePlaceholder')}
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
                    {t('groceryAddStapleButton')}
                  </ThemedText>
                </Pressable>
              </>
            )}

            {grocery.staples.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('groceryStaplesEmptyState')}
              </ThemedText>
            ) : (
              grocery.staples.map((staple) => (
                <View key={staple.id} style={styles.templateRow}>
                  <ThemedText type="small" style={styles.templateNameColumn}>
                    {categoryEmoji(staple.category)} {staple.name}
                  </ThemedText>
                  <Pressable onPress={() => grocery.deleteStaple(staple).catch(() => showAlert(t('groceryRemoveStapleErrorTitle')))} hitSlop={8}>
                    <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>
              ))
            )}
          </CollapsibleCard>
        </ScrollView>
      ) : mode === 'recipes' ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <Animated.View layout={LinearTransition.duration(200)}>
            <ThemedView type="backgroundElement" style={styles.addCard}>
              {editingRecipeId && (
                <View style={styles.editingRow}>
                  <ThemedText type="smallBold">{t('recipeEditHeading')}</ThemedText>
                  <Pressable onPress={resetRecipeForm} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      {t('cancel')}
                    </ThemedText>
                  </Pressable>
                </View>
              )}
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('recipeTitlePlaceholder')}
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
                        onPressIn={recipeComposerBlur.onFocus}
                        onPress={() => setRecipeCategory(c.value)}
                        style={[
                          styles.pill,
                          { backgroundColor: theme.backgroundSelected },
                          recipeCategory === c.value && { backgroundColor: theme.accent },
                        ]}>
                        <ThemedText type="small" themeColor={recipeCategory === c.value ? 'background' : 'textSecondary'}>
                          {t(RECIPE_CATEGORY_KEY[c.value] ?? 'recipeCategoryOther')}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <TextInput
                    style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('recipeServingsPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={recipeServings}
                    onChangeText={(v) => setRecipeServings(sanitizeNumericInput(v))}
                    onFocus={recipeComposerBlur.onFocus}
                    onBlur={recipeComposerBlur.onBlur}
                  />

                  <ThemedText type="small" themeColor="textSecondary">
                    {t('recipeIngredientsLabel')}
                  </ThemedText>
                  {ingredientDrafts.map((draft, index) => (
                    <View key={index} style={styles.ingredientRow}>
                      <TextInput
                        style={[styles.input, styles.ingredientNameInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                        placeholder={t('recipeIngredientNamePlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        value={draft.name}
                        onChangeText={(text) => updateIngredientDraft(index, { name: text })}
                        onFocus={recipeComposerBlur.onFocus}
                        onBlur={recipeComposerBlur.onBlur}
                      />
                      <TextInput
                        style={[styles.input, styles.ingredientQuantityInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                        placeholder={t('recipeIngredientQtyPlaceholder')}
                        placeholderTextColor={theme.textSecondary}
                        value={draft.quantity}
                        onChangeText={(text) => updateIngredientDraft(index, { quantity: text })}
                        onFocus={recipeComposerBlur.onFocus}
                        onBlur={recipeComposerBlur.onBlur}
                      />
                      <Pressable onPressIn={recipeComposerBlur.onFocus} onPress={() => removeIngredientRow(index)} hitSlop={8}>
                        <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </View>
                  ))}
                  <Pressable onPressIn={recipeComposerBlur.onFocus} onPress={addIngredientRow} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      {t('recipeAddIngredientButton')}
                    </ThemedText>
                  </Pressable>

                  <TextInput
                    style={[styles.input, styles.instructionsInput, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
                    placeholder={t('recipeInstructionsPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    value={recipeInstructions}
                    onChangeText={setRecipeInstructions}
                    onFocus={recipeComposerBlur.onFocus}
                    onBlur={recipeComposerBlur.onBlur}
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
                        {editingRecipeId ? t('saveChanges') : t('recipeAddButton')}
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
                  {t('allFilter')}
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
                    {t(RECIPE_CATEGORY_KEY[c.value] ?? 'recipeCategoryOther')}
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
                {t('recipeEmptyState')}
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
                        {t(RECIPE_CATEGORY_KEY[recipe.category] ?? 'recipeCategoryOther')}
                        {recipe.servings ? t('recipeServesCaption', { count: recipe.servings }) : ''}
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
                          <ThemedText type="small">{t('recipeAddIngredientsToList')}</ThemedText>
                        </ThemedView>
                      </Pressable>
                      <Pressable onPress={() => startEditRecipe(recipe)} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          {t('edit')}
                        </ThemedText>
                      </Pressable>
                      <Pressable onPress={() => confirmDeleteRecipe(recipe)} hitSlop={8}>
                        <ThemedText type="small" style={styles.deleteText}>
                          {t('delete')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}
              </ThemedView>
            );
          })}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          <ThemedView type="backgroundElement" style={styles.weekNavCard}>
            <View style={styles.weekNavRow}>
              <NavArrowButton direction="prev" onPress={goToPreviousWeek} />
              <ThemedText type="smallBold">{weekLabel}</ThemedText>
              <NavArrowButton direction="next" onPress={goToNextWeek} />
            </View>

            <Pressable
              onPress={handleAddWeekIngredients}
              disabled={addingWeekIngredients}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundSelected" style={[styles.addButton, addingWeekIngredients && styles.saveButtonDisabled]}>
                {addingWeekIngredients ? (
                  <ActivityIndicator color={theme.text} />
                ) : (
                  <ThemedText type="smallBold">{t('groceryAddWeekIngredients')}</ThemedText>
                )}
              </ThemedView>
            </Pressable>
          </ThemedView>

          {weekDates.map((dateIso, i) => {
            const plan = plansByDate.get(dateIso);
            const dayDate = new Date(`${dateIso}T00:00:00`);
            const isComposerOpen = mealComposerDate === dateIso;
            const recipe = plan?.recipe_id ? recipes.find((r) => r.id === plan.recipe_id) : null;

            return (
              <ThemedView key={dateIso} type="backgroundElement" style={styles.dayCard}>
                <View style={styles.dayHeaderRow}>
                  <View style={styles.templateNameColumn}>
                    <ThemedText type="smallBold">{t(WEEKDAY_KEYS[i])}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatMonthDay(dayDate, language)}
                    </ThemedText>
                  </View>
                  {plan && (
                    <Pressable onPress={() => confirmClearMeal(plan)} hitSlop={8}>
                      <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                        ×
                      </ThemedText>
                    </Pressable>
                  )}
                </View>

                {plan ? (
                  <Pressable onPress={() => openMealComposer(dateIso)}>
                    {/* A plan's recipe_id is on delete set null (the app-wide
                        convention) — if the linked recipe was since deleted,
                        neither `recipe` nor `plan.title` (never set for a
                        recipe-linked plan) would be available, so this falls
                        back rather than rendering a blank, confusing row. */}
                    <ThemedText type="default">{recipe ? recipe.title : (plan.title ?? t('mealPlanRecipeRemoved'))}</ThemedText>
                    {recipe && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {t(RECIPE_CATEGORY_KEY[recipe.category] ?? 'recipeCategoryOther')}
                        {recipe.servings ? t('recipeServesCaption', { count: recipe.servings }) : ''}
                      </ThemedText>
                    )}
                  </Pressable>
                ) : !isComposerOpen ? (
                  <Pressable onPress={() => openMealComposer(dateIso)} hitSlop={8}>
                    <ThemedText type="small" themeColor="accent">
                      {t('mealPlanAddButton')}
                    </ThemedText>
                  </Pressable>
                ) : null}

                {isComposerOpen && (
                  <View style={styles.mealComposer}>
                    <View style={styles.editingRow}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {plan ? t('mealPlanChangeHeading') : t('mealPlanAddHeading')}
                      </ThemedText>
                      <Pressable onPress={closeMealComposer} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          {t('cancel')}
                        </ThemedText>
                      </Pressable>
                    </View>

                    <View style={styles.modeRow}>
                      {(['recipe', 'custom'] as const).map((pm) => (
                        <Pressable
                          key={pm}
                          onPress={() => setMealPickMode(pm)}
                          style={[
                            styles.pill,
                            styles.modePill,
                            { backgroundColor: theme.backgroundSelected },
                            mealPickMode === pm && { backgroundColor: theme.accent },
                          ]}>
                          <ThemedText type="small" themeColor={mealPickMode === pm ? 'background' : 'textSecondary'}>
                            {pm === 'recipe' ? t('mealPlanModeRecipe') : t('mealPlanModeCustom')}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>

                    {mealPickMode === 'recipe' ? (
                      recipes.length === 0 ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('mealPlanNoRecipesHint')}
                        </ThemedText>
                      ) : (
                        <View style={styles.mealRecipeList}>
                          {recipes.map((r) => (
                            <Pressable
                              key={r.id}
                              disabled={mealSubmitting}
                              onPress={() => handlePickRecipeForMeal(r)}
                              style={styles.templateRow}>
                              <ThemedText type="small" style={styles.templateNameColumn}>
                                {r.title}
                              </ThemedText>
                            </Pressable>
                          ))}
                        </View>
                      )
                    ) : (
                      <>
                        <TextInput
                          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                          placeholder={t('mealPlanCustomTitlePlaceholder')}
                          placeholderTextColor={theme.textSecondary}
                          value={mealCustomTitle}
                          onChangeText={setMealCustomTitle}
                          onSubmitEditing={handleSaveCustomMeal}
                          returnKeyType="done"
                        />
                        <Pressable
                          style={[
                            styles.addButton,
                            { backgroundColor: theme.accent, opacity: mealCustomTitle.trim() && !mealSubmitting ? 1 : 0.5 },
                          ]}
                          disabled={!mealCustomTitle.trim() || mealSubmitting}
                          onPress={handleSaveCustomMeal}>
                          <ThemedText type="smallBold" themeColor="background">
                            {t('save')}
                          </ThemedText>
                        </Pressable>
                      </>
                    )}
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
  addCard: { borderRadius: Spacing.four, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, gap: Spacing.two },
  editingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { fontSize: 16, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two, borderRadius: Spacing.two },
  quantityInput: { marginTop: Spacing.one },
  // flexShrink: 1 + minWidth: 0 — see kids-section.tsx's identical
  // pillRow comment (RN's flexShrink defaults to 0 for a plain
  // ScrollView, and web's min-width:auto blocks shrinking even with
  // flexShrink set) — without both, a pill row wider than its card
  // overflows the rounded edge and clips the last pill instead of
  // scrolling to it (found on the grocery category filter row).
  pillRow: { flexGrow: 0, flexShrink: 1, minWidth: 0 },
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
  // minWidth: 0 — same web flexbox fix as pillRow above: without it, a
  // long item name won't shrink to wrap and instead overflows past the
  // card's edge.
  itemTextWrapper: { flex: 1, minWidth: 0, gap: Spacing.half },
  doneText: { textDecorationLine: 'line-through' },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
  deleteText: { color: '#e5484d' },
  saveTemplateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  saveTemplateInput: { flex: 1, minWidth: 0 },
  templateRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // minWidth: 0 — same web flexbox fix as pillRow above.
  templateNameColumn: { flex: 1, minWidth: 0, gap: Spacing.half },
  templateEditor: { gap: Spacing.two, paddingLeft: Spacing.three, marginTop: Spacing.one, marginBottom: Spacing.two },
  addCurrentListButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  useButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  // minWidth: 0 overrides web's default min-width:auto on flex items —
  // without it a rendered <input>'s intrinsic size wins over flex-grow
  // and the row overflows instead of splitting per the flex ratio.
  ingredientNameInput: { flex: 2, minWidth: 0 },
  ingredientQuantityInput: { flex: 1, minWidth: 0 },
  instructionsInput: { minHeight: 80, textAlignVertical: 'top' },
  recipeCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  recipeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 20, lineHeight: 20 },
  recipeDetails: { gap: Spacing.two, marginTop: Spacing.one },
  instructionsText: { marginTop: Spacing.one },
  recipeActionsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.four, marginTop: Spacing.one },
  weekNavCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  mealComposer: { gap: Spacing.two, marginTop: Spacing.one },
  mealRecipeList: { gap: Spacing.one },
});
