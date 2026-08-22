import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotesIcon } from '@/components/icons/section-icons';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing, WebTabBarHeight } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLanguage, useTranslation } from '@/hooks/use-language';
import { useNotes } from '@/hooks/use-notes';
import { useTheme } from '@/hooks/use-theme';
import { showAlert } from '@/lib/alert';
import { formatNoteTimestamp } from '@/lib/note-format';
import type { Note } from '@/types/note';

export default function NotesScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = { ...safeAreaInsets, bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three };
  const theme = useTheme();
  const t = useTranslation();
  const { language } = useLanguage();
  const { members } = useHousehold();
  const { notes, loading, currentUserId, addNote, updateNote, deleteNote } = useNotes();

  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function authorName(note: Note): string {
    if (note.created_by === currentUserId) return t('notesAuthorYou');
    return members.find((m) => m.user_id === note.created_by)?.profile?.full_name?.trim() || t('notesAuthorFallback');
  }

  async function handleAdd() {
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await addNote({ body: draft });
      setDraft('');
    } catch (err) {
      showAlert(t('notesAddError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditDraft(note.body);
  }

  async function saveEdit(note: Note) {
    if (!editDraft.trim()) return;
    setSavingEdit(true);
    try {
      await updateNote(note, { body: editDraft });
      setEditingId(null);
    } catch (err) {
      showAlert(t('notesSaveError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingEdit(false);
    }
  }

  function confirmDelete(note: Note) {
    showAlert(t('notesDeleteConfirmTitle'), t('notesDeleteConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: () => {
          if (editingId === note.id) setEditingId(null);
          deleteNote(note).catch((err) => showAlert(t('notesDeleteError'), err instanceof Error ? err.message : t('genericErrorMessage')));
        },
      },
    ]);
  }

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      // WebTabBarHeight clears the tab bar's own bottom edge, plus a
      // small visible gap (see index.tsx's identical comment).
      paddingTop: WebTabBarHeight + Spacing.two,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{t('notesTitle')}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {t('notesSubtitle')}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.addCard}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            placeholder={t('notesComposerPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={draft}
            onChangeText={setDraft}
            multiline
          />
          <Pressable
            style={[styles.addButton, { backgroundColor: theme.accent, opacity: draft.trim() && !submitting ? 1 : 0.5 }]}
            disabled={!draft.trim() || submitting}
            onPress={handleAdd}>
            {submitting ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" themeColor="background">
                {t('notesAddButton')}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>

        {loading && notes.length === 0 && <ActivityIndicator color={theme.accent} style={styles.loadingSpinner} />}

        {!loading && notes.length === 0 && (
          <View style={styles.emptyState}>
            <NotesIcon color={theme.backgroundSelected} size={40} />
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {t('notesEmptyState')}
            </ThemedText>
          </View>
        )}

        <View style={styles.notesColumn}>
          {notes.map((note) => (
            <Animated.View key={note.id} layout={LinearTransition.duration(220)} exiting={FadeOut.duration(200)}>
              <ThemedView type="backgroundElement" style={[styles.noteCard, editingId === note.id && { borderColor: theme.accent, borderWidth: 1 }]}>
                {editingId === note.id ? (
                  <>
                    <TextInput
                      style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
                      value={editDraft}
                      onChangeText={setEditDraft}
                      multiline
                      autoFocus
                    />
                    <View style={styles.editActionsRow}>
                      <Pressable disabled={savingEdit} onPress={() => saveEdit(note)} hitSlop={8}>
                        <ThemedText type="smallBold" themeColor="accent">
                          {savingEdit ? t('saving') : t('save')}
                        </ThemedText>
                      </Pressable>
                      <Pressable disabled={savingEdit} onPress={() => setEditingId(null)} hitSlop={8}>
                        <ThemedText type="small" themeColor="textSecondary">
                          {t('cancel')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.noteHeaderRow}>
                      <Pressable style={styles.noteTextWrapper} onPress={() => startEdit(note)}>
                        <ThemedText type="default">{note.body}</ThemedText>
                      </Pressable>
                      <Pressable onPress={() => confirmDelete(note)} hitSlop={8}>
                        <ThemedText themeColor="textSecondary" style={styles.deleteIcon}>
                          ×
                        </ThemedText>
                      </Pressable>
                    </View>
                    <ThemedText type="small" themeColor="textSecondary">
                      {authorName(note)} · {formatNoteTimestamp(note.updated_at, new Date(), language)}
                    </ThemedText>
                  </>
                )}
              </ThemedView>
            </Animated.View>
          ))}
        </View>

        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  container: { maxWidth: MaxContentWidth, flexGrow: 1, gap: Spacing.four, paddingHorizontal: Spacing.four },
  titleContainer: { gap: Spacing.two, alignItems: 'center', paddingTop: Spacing.three },
  centerText: { textAlign: 'center' },
  addCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.two },
  input: { fontSize: 16, paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderRadius: Spacing.two, minHeight: 44 },
  addButton: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.two },
  loadingSpinner: { marginTop: Spacing.six },
  emptyState: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.six },
  emptyText: { textAlign: 'center' },
  notesColumn: { gap: Spacing.two, paddingBottom: Spacing.four },
  noteCard: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.one },
  noteHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  noteTextWrapper: { flex: 1 },
  editActionsRow: { flexDirection: 'row', gap: Spacing.three },
  deleteIcon: { fontSize: 24, lineHeight: 24, paddingHorizontal: Spacing.one },
});
