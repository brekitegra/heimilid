import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CollapsibleCard } from '@/components/collapsible-card';
import { LegalLinks } from '@/components/legal-links';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { XpProgressBar } from '@/components/xp-progress-bar';
import { BottomTabInset, MaxContentWidth, Spacing, WebTabBarHeight } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useLanguage, useTranslation, type Language, type TranslationKey } from '@/hooks/use-language';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { showAlert } from '@/lib/alert';
import { formatKennitala, isValidKennitala } from '@/lib/kennitala';
import { shareHouseholdInvite } from '@/lib/share-invite';
import { levelForXp, rankBadge, sortMembersByXp, xpProgressForLevel } from '@/lib/xp';

const APPEARANCE_OPTIONS: { key: ThemePreference; labelKey: TranslationKey }[] = [
  { key: 'system', labelKey: 'system' },
  { key: 'light', labelKey: 'light' },
  { key: 'dark', labelKey: 'dark' },
];

const LANGUAGE_OPTIONS: { key: Language; labelKey: TranslationKey }[] = [
  { key: 'en', labelKey: 'english' },
  { key: 'is', labelKey: 'icelandic' },
];

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = { ...safeAreaInsets, bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three };
  const theme = useTheme();
  const t = useTranslation();
  const { language, setLanguage } = useLanguage();
  const { household, members, renameHousehold, removeMember, promoteToOwner } = useHousehold();
  const {
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
  } = useProfile();
  const { preference, setPreference } = useThemePreference();

  const [loggingOut, setLoggingOut] = useState(false);

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const [editingKennitala, setEditingKennitala] = useState(false);
  const [kennitalaDraft, setKennitalaDraft] = useState('');
  const [savingKennitala, setSavingKennitala] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordJustChanged, setPasswordJustChanged] = useState(false);

  const [editingHouseholdName, setEditingHouseholdName] = useState(false);
  const [householdNameDraft, setHouseholdNameDraft] = useState('');
  const [renamingHousehold, setRenamingHousehold] = useState(false);

  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [sendingEmailChange, setSendingEmailChange] = useState(false);

  const [removingAvatar, setRemovingAvatar] = useState(false);

  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  const kennitalaDraftError = kennitalaDraft.trim().length > 0 && !isValidKennitala(kennitalaDraft);

  const myMembership = members.find((m) => m.user_id === profile?.id);
  const isOwner = myMembership?.role === 'owner';
  const leaderboard = sortMembersByXp(members);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canChangePassword = currentPassword.length > 0 && newPassword.length >= 6 && passwordsMatch;

  // Deleting the sole owner of a household with other people still in it
  // would leave it permanently stuck — no one left could rename it or
  // manage members. Block that specific case rather than letting it happen
  // silently; solo households (or ones with a co-owner already) are fine.
  const otherOwnerExists = members.some((m) => m.role === 'owner' && m.user_id !== profile?.id);
  const wouldOrphanHousehold = isOwner && members.length > 1 && !otherOwnerExists;
  const deleteConfirmMatches = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  function startEditingName() {
    setNameDraft(profile?.full_name ?? '');
    setEditingName(true);
  }

  async function saveNameEdit() {
    setSavingName(true);
    try {
      await updateProfile({ full_name: nameDraft.trim() || null });
      setEditingName(false);
    } catch (err) {
      showAlert(t('profileSaveNameError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingName(false);
    }
  }

  function startEditingPhone() {
    setPhoneDraft(profile?.phone ?? '');
    setEditingPhone(true);
  }

  async function savePhoneEdit() {
    setSavingPhone(true);
    try {
      await updateProfile({ phone: phoneDraft.trim() || null });
      setEditingPhone(false);
    } catch (err) {
      showAlert(t('profileSavePhoneError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingPhone(false);
    }
  }

  function startEditingKennitala() {
    setKennitalaDraft(profile?.kennitala ?? '');
    setEditingKennitala(true);
  }

  async function saveKennitalaEdit() {
    if (kennitalaDraftError) {
      showAlert(t('profileKennitalaInvalidTitle'), t('profileKennitalaInvalidBody'));
      return;
    }
    setSavingKennitala(true);
    try {
      await updateProfile({ kennitala: kennitalaDraft.trim() || null });
      setEditingKennitala(false);
    } catch (err) {
      showAlert(t('profileSaveKennitalaError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSavingKennitala(false);
    }
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      showAlert(t('profilePasswordTooShortTitle'), t('profilePasswordTooShortBody'));
      return;
    }
    if (!passwordsMatch) {
      showAlert(t('passwordsDontMatchTitle'), t('profilePasswordsDontMatchBody'));
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordJustChanged(true);
      setTimeout(() => setPasswordJustChanged(false), 2000);
    } catch (err) {
      showAlert(t('profileChangePasswordError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleChangeAvatar() {
    try {
      await pickAndUploadAvatar();
    } catch (err) {
      showAlert(t('profileUpdatePhotoError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    }
  }

  function confirmRemoveAvatar() {
    showAlert(t('profileRemovePhotoConfirmTitle'), t('profileRemovePhotoConfirmBody'), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          setRemovingAvatar(true);
          try {
            await removeAvatar();
          } catch (err) {
            showAlert(t('profileRemovePhotoError'), err instanceof Error ? err.message : t('genericErrorMessage'));
          } finally {
            setRemovingAvatar(false);
          }
        },
      },
    ]);
  }

  function startEditingEmail() {
    setEmailDraft(email ?? '');
    setEditingEmail(true);
  }

  async function sendEmailChange() {
    const trimmed = emailDraft.trim();
    if (!trimmed) return;
    setSendingEmailChange(true);
    try {
      await changeEmail(trimmed);
      setEditingEmail(false);
      showAlert(t('profileEmailChangeSentTitle'), t('profileEmailChangeSentBody', { email: trimmed }));
    } catch (err) {
      showAlert(t('profileChangeEmailError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setSendingEmailChange(false);
    }
  }

  async function shareInvite() {
    if (!household) return;
    await shareHouseholdInvite(household, language);
  }

  function startEditingHouseholdName() {
    setHouseholdNameDraft(household?.name ?? '');
    setEditingHouseholdName(true);
  }

  async function saveHouseholdName() {
    if (!householdNameDraft.trim()) return;
    setRenamingHousehold(true);
    try {
      await renameHousehold(householdNameDraft);
      setEditingHouseholdName(false);
    } catch (err) {
      showAlert(t('profileRenameHouseholdError'), err instanceof Error ? err.message : t('genericErrorMessage'));
    } finally {
      setRenamingHousehold(false);
    }
  }

  function confirmRemoveMember(memberName: string, userId: string) {
    showAlert(t('profileRemoveMemberConfirmTitle'), t('profileRemoveMemberConfirmBody', { name: memberName }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('remove'),
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(userId);
          } catch (err) {
            showAlert(t('profileRemoveMemberError'), err instanceof Error ? err.message : t('genericErrorMessage'));
          }
        },
      },
    ]);
  }

  function confirmPromoteToOwner(memberName: string, userId: string) {
    showAlert(t('profileMakeOwner'), t('profileMakeOwnerConfirmBody', { name: memberName }), [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('profileMakeOwner'),
        onPress: async () => {
          try {
            await promoteToOwner(userId);
          } catch (err) {
            showAlert(t('profileUpdateRoleError'), err instanceof Error ? err.message : t('genericErrorMessage'));
          }
        },
      },
    ]);
  }

  async function handleDeleteAccount() {
    if (!deleteConfirmMatches) return;
    setDeletingAccount(true);
    try {
      await deleteAccount();
      // deleteAccount already signs the local session out — _layout.tsx's
      // session listener takes it from here back to the auth screen.
    } catch (err) {
      showAlert(t('profileDeleteAccountError'), err instanceof Error ? err.message : t('genericErrorMessage'));
      setDeletingAccount(false);
    }
  }

  // No "are you sure?" here on purpose — logging out isn't destructive
  // (you can always sign back in), so it just happens on tap rather than
  // demanding an extra confirmation click.
  async function handleLogOut() {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (err) {
      showAlert(t('profileLogOutError'), err instanceof Error ? err.message : t('genericErrorMessage'));
      setLoggingOut(false);
    }
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

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  const xp = profile?.xp ?? 0;
  const { level, xpIntoLevel, xpForNextLevel } = xpProgressForLevel(xp);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.header}>
          <Pressable onPress={handleChangeAvatar} disabled={uploadingAvatar} hitSlop={8} testID="profile-avatar-button">
            <View>
              <Avatar url={profile?.avatar_url} name={profile?.full_name} size={88} />
              <View style={[styles.avatarBadge, { backgroundColor: theme.accent, borderColor: theme.background }]}>
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={theme.background} />
                ) : (
                  <ThemedText type="small" themeColor="background" style={styles.avatarBadgeIcon}>
                    ✎
                  </ThemedText>
                )}
              </View>
            </View>
          </Pressable>
          <ThemedText type="subtitle" style={styles.centerText}>
            {profile?.full_name?.trim() || t('unnamedFallback')}
          </ThemedText>

          {editingEmail ? (
            <View style={styles.emailEditRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.emailInput,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder={t('authEmailPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoFocus
              />
              <Pressable disabled={sendingEmailChange} onPress={sendEmailChange} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="accent">
                  {sendingEmailChange ? '…' : t('sendButton')}
                </ThemedText>
              </Pressable>
              <Pressable disabled={sendingEmailChange} onPress={() => setEditingEmail(false)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('cancel')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={startEditingEmail} style={({ pressed }) => pressed && styles.pressed}>
              <View style={styles.emailRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  {email}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  ✎
                </ThemedText>
              </View>
            </Pressable>
          )}

          {!!profile?.avatar_url && (
            <Pressable disabled={removingAvatar} onPress={confirmRemoveAvatar} hitSlop={8}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.removePhotoText}>
                {removingAvatar ? t('removingInProgress') : t('profileRemovePhotoConfirmTitle')}
              </ThemedText>
            </Pressable>
          )}

          <View style={styles.xpBlock}>
            <View style={styles.xpLabelRow}>
              <ThemedText type="smallBold">{t('profileLevelLabel', { level })}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('profileXpProgressLabel', { xp: xpIntoLevel, next: xpForNextLevel })}
              </ThemedText>
            </View>
            <XpProgressBar xp={xp} />
          </View>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('aboutYou')}
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('name')}
            </ThemedText>
            {editingName ? (
              <View style={styles.emailEditRow}>
                <TextInput
                  style={[styles.input, styles.emailInput, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
                  placeholder={t('profileNamePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  value={nameDraft}
                  onChangeText={setNameDraft}
                  autoFocus
                />
                <Pressable disabled={savingName} onPress={saveNameEdit} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {savingName ? '…' : t('save')}
                  </ThemedText>
                </Pressable>
                <Pressable disabled={savingName} onPress={() => setEditingName(false)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('cancel')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEditingName} style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.emailRow}>
                  <ThemedText type="default" themeColor="textSecondary">
                    {profile?.full_name?.trim() || t('notSet')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ✎
                  </ThemedText>
                </View>
              </Pressable>
            )}
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('phone')}
            </ThemedText>
            {editingPhone ? (
              <View style={styles.emailEditRow}>
                <TextInput
                  style={[styles.input, styles.emailInput, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
                  placeholder={t('profilePhonePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="phone-pad"
                  value={phoneDraft}
                  onChangeText={setPhoneDraft}
                  autoFocus
                />
                <Pressable disabled={savingPhone} onPress={savePhoneEdit} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {savingPhone ? '…' : t('save')}
                  </ThemedText>
                </Pressable>
                <Pressable disabled={savingPhone} onPress={() => setEditingPhone(false)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('cancel')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable onPress={startEditingPhone} style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.emailRow}>
                  <ThemedText type="default" themeColor="textSecondary">
                    {profile?.phone?.trim() || t('notSet')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ✎
                  </ThemedText>
                </View>
              </Pressable>
            )}
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('kennitala')}
            </ThemedText>
            {editingKennitala ? (
              <>
                <View style={styles.emailEditRow}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.emailInput,
                      { backgroundColor: theme.background, borderColor: kennitalaDraftError ? '#e5484d' : theme.backgroundSelected, color: theme.text },
                    ]}
                    placeholder={t('profileKennitalaPlaceholder')}
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="number-pad"
                    value={kennitalaDraft}
                    onChangeText={(text) => setKennitalaDraft(formatKennitala(text))}
                    maxLength={11}
                    autoFocus
                  />
                  <Pressable disabled={savingKennitala} onPress={saveKennitalaEdit} hitSlop={8}>
                    <ThemedText type="smallBold" themeColor="accent">
                      {savingKennitala ? '…' : t('save')}
                    </ThemedText>
                  </Pressable>
                  <Pressable disabled={savingKennitala} onPress={() => setEditingKennitala(false)} hitSlop={8}>
                    <ThemedText type="small" themeColor="textSecondary">
                      {t('cancel')}
                    </ThemedText>
                  </Pressable>
                </View>
                {kennitalaDraftError && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                    {t('profileKennitalaInvalidBody')}
                  </ThemedText>
                )}
              </>
            ) : (
              <Pressable onPress={startEditingKennitala} style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.emailRow}>
                  <ThemedText type="default" themeColor="textSecondary">
                    {profile?.kennitala?.trim() || t('notSet')}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    ✎
                  </ThemedText>
                </View>
              </Pressable>
            )}
          </View>
        </ThemedView>

        <CollapsibleCard title={t('password')}>
          <View style={styles.field}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder={t('profileCurrentPasswordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
          </View>
          <View style={styles.field}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder={t('newPasswordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={newPassword.length > 0 && newPassword.length < 6 && styles.errorText}>
              {t('profilePasswordHint')}
            </ThemedText>
          </View>
          <View style={styles.field}>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: theme.background,
                  borderColor: confirmPassword.length > 0 && !passwordsMatch ? '#e5484d' : theme.backgroundSelected,
                  color: theme.text,
                },
              ]}
              placeholder={t('confirmNewPasswordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                {t('profilePasswordsDontMatchInline')}
              </ThemedText>
            )}
          </View>

          <Pressable onPress={() => setShowPasswords((v) => !v)} hitSlop={8} style={styles.showPasswordsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {showPasswords ? t('hidePasswords') : t('showPasswords')}
            </ThemedText>
          </Pressable>

          <Pressable
            disabled={!canChangePassword || changingPassword}
            onPress={handleChangePassword}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={[styles.saveButton, !canChangePassword && !changingPassword && styles.saveButtonDisabled]}>
              {changingPassword ? (
                <ActivityIndicator size="small" color={theme.text} />
              ) : (
                <ThemedText type="smallBold">{passwordJustChanged ? t('profilePasswordUpdatedCheck') : t('updatePasswordButton')}</ThemedText>
              )}
            </ThemedView>
          </Pressable>
        </CollapsibleCard>

        <CollapsibleCard title={t('appearance')}>
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map((option) => {
              const active = preference === option.key;
              return (
                <Pressable key={option.key} onPress={() => setPreference(option.key)} style={styles.appearanceOption}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'background'}
                    style={[styles.appearancePill, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                    <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                      {t(option.labelKey)}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        </CollapsibleCard>

        <CollapsibleCard title={t('language')}>
          <View style={styles.appearanceRow}>
            {LANGUAGE_OPTIONS.map((option) => {
              const active = language === option.key;
              return (
                <Pressable key={option.key} onPress={() => setLanguage(option.key)} style={styles.appearanceOption}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'background'}
                    style={[styles.appearancePill, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                    <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                      {t(option.labelKey)}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </View>
        </CollapsibleCard>

        {household && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {t('household')}
            </ThemedText>

            {editingHouseholdName ? (
              <View style={styles.householdNameEditRow}>
                <TextInput
                  style={[
                    styles.input,
                    styles.householdNameInput,
                    { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text },
                  ]}
                  value={householdNameDraft}
                  onChangeText={setHouseholdNameDraft}
                  autoFocus
                />
                <Pressable disabled={renamingHousehold} onPress={saveHouseholdName} hitSlop={8}>
                  <ThemedText type="smallBold" themeColor="accent">
                    {renamingHousehold ? '…' : t('save')}
                  </ThemedText>
                </Pressable>
                <Pressable disabled={renamingHousehold} onPress={() => setEditingHouseholdName(false)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('cancel')}
                  </ThemedText>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={isOwner ? startEditingHouseholdName : undefined}
                style={({ pressed }) => pressed && isOwner && styles.pressed}>
                <View style={styles.householdNameRow}>
                  <ThemedText type="default">{household.name}</ThemedText>
                  {isOwner && (
                    <ThemedText type="small" themeColor="textSecondary">
                      ✎
                    </ThemedText>
                  )}
                </View>
              </Pressable>
            )}

            <ThemedView type="background" style={styles.inviteRow}>
              <View style={styles.inviteTextColumn}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('inviteCode')}
                </ThemedText>
                <ThemedText type="smallBold" style={styles.inviteCode}>
                  {household.invite_code}
                </ThemedText>
              </View>
              <Pressable onPress={shareInvite} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundSelected" style={styles.shareButton}>
                  <ThemedText type="linkPrimary">{t('share')}</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>

            <View style={styles.memberList}>
              <ThemedText type="small" themeColor="textSecondary">
                {members.length >= 2 ? t('leaderboard') : t('yourHousehold')}
              </ThemedText>
              {leaderboard.map((member, index) => {
                const isSelf = member.user_id === profile?.id;
                return (
                  <View key={member.user_id} style={styles.memberRow}>
                    {members.length >= 2 && (
                      <ThemedText type="smallBold" style={styles.rankBadge}>
                        {rankBadge(index)}
                      </ThemedText>
                    )}
                    <Avatar url={member.profile?.avatar_url} name={member.profile?.full_name} size={32} />
                    <View style={styles.memberNameColumn}>
                      <ThemedText type="small">
                        {member.profile?.full_name?.trim() || t('unnamedFallback')}
                        {isSelf ? ` ${t('youSuffix')}` : ''}
                        {member.role === 'owner' ? ` · ${t('roleOwner')}` : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('profileLevelLabel', { level: levelForXp(member.profile?.xp ?? 0) })}
                      </ThemedText>
                    </View>
                    {isOwner && !isSelf && (
                      <View style={styles.memberActions}>
                        {member.role !== 'owner' && (
                          <Pressable
                            onPress={() => confirmPromoteToOwner(member.profile?.full_name?.trim() || t('someone'), member.user_id)}
                            hitSlop={8}>
                            <ThemedText type="small" themeColor="accent">
                              {t('profileMakeOwner')}
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => confirmRemoveMember(member.profile?.full_name?.trim() || t('someone'), member.user_id)}
                          hitSlop={8}
                          style={({ pressed }) => pressed && styles.pressed}>
                          <ThemedView type="backgroundSelected" style={styles.removeButton}>
                            <ThemedText type="small" style={styles.removeText}>
                              {t('remove')}
                            </ThemedText>
                          </ThemedView>
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </ThemedView>
        )}

        <Pressable disabled={loggingOut} onPress={handleLogOut} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="link" style={styles.logOutText}>
            {loggingOut ? t('loggingOutInProgress') : t('logOut')}
          </ThemedText>
        </Pressable>

        <View style={styles.legalRow}>
          <LegalLinks />
        </View>

        <CollapsibleCard title={t('dangerZone')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('profileDangerZoneWarning')}
          </ThemedText>

          {wouldOrphanHousehold ? (
            <ThemedText type="small" style={styles.errorText}>
              {t('profileWouldOrphanHouseholdWarning', { name: household?.name ?? '' })}
            </ThemedText>
          ) : (
            <>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('profileTypeDeleteToConfirm')}
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
                  placeholder={t('profileDeletePlaceholder')}
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="characters"
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                />
              </View>
              <Pressable
                disabled={!deleteConfirmMatches || deletingAccount}
                onPress={handleDeleteAccount}
                style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView style={[styles.deleteButton, (!deleteConfirmMatches || deletingAccount) && styles.saveButtonDisabled]}>
                  {deletingAccount ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <ThemedText type="smallBold" style={styles.deleteButtonText}>
                      {t('profileDeleteAccountButton')}
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            </>
          )}
        </CollapsibleCard>

        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  contentContainer: { flexDirection: 'row', justifyContent: 'center' },
  // flexShrink: 1 + minWidth: 0 — this is a flexGrow:1 child of a row
  // (contentContainer). RN defaults flexShrink to 0 for a plain View
  // (unlike raw CSS, which defaults to 1), so without it explicitly this
  // column never shrinks below its widest descendant's natural content
  // width no matter what minWidth says (e.g. a long translated sentence
  // deep inside a CollapsibleCard) — and minWidth: 0 is needed too, since
  // web's default min-width:auto on flex items blocks shrinking even with
  // flexShrink set. Same two-part gotcha documented throughout this app
  // (paired TextInputs, the web tab bar). Without both, that one long
  // line silently stretches this whole column past the viewport instead
  // of wrapping.
  container: { maxWidth: MaxContentWidth, flexGrow: 1, flexShrink: 1, minWidth: 0, gap: Spacing.four, paddingHorizontal: Spacing.four },
  header: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.three },
  centerText: { textAlign: 'center' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeIcon: { fontSize: 13, lineHeight: 15 },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  emailEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, alignSelf: 'stretch' },
  emailInput: { flex: 1, paddingVertical: Spacing.two },
  removePhotoText: { textDecorationLine: 'underline' },
  xpBlock: { alignSelf: 'stretch', gap: Spacing.one, marginTop: Spacing.one },
  xpLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  card: { borderRadius: Spacing.four, padding: Spacing.three, gap: Spacing.three },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.three, padding: Spacing.three },
  errorText: { color: '#e5484d' },
  pressed: { opacity: 0.7 },
  saveButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 999 },
  saveButtonDisabled: { opacity: 0.5 },
  showPasswordsRow: { alignSelf: 'flex-start' },
  appearanceRow: { flexDirection: 'row', gap: Spacing.two },
  // minWidth: 0 — web's default min-width:auto on flex items blocks
  // shrinking below content size otherwise (the same gotcha documented
  // throughout this app) — without it, the longest label (e.g.
  // "Kerfi"/"System") refuses to shrink and pushes the other two pills
  // out past the row's edge instead of all three dividing the space
  // evenly.
  appearanceOption: { flex: 1, minWidth: 0 },
  appearancePill: { alignItems: 'center', paddingVertical: Spacing.two, borderRadius: Spacing.three },
  householdNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  householdNameEditRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  householdNameInput: { flex: 1, paddingVertical: Spacing.two },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  inviteTextColumn: { gap: Spacing.half },
  inviteCode: { letterSpacing: 3 },
  shareButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  memberList: { gap: Spacing.two },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rankBadge: { minWidth: 28 },
  memberNameColumn: { flex: 1, gap: Spacing.half },
  memberActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  removeButton: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, borderRadius: Spacing.five },
  removeText: { color: '#e5484d' },
  logOutText: { textAlign: 'center', color: '#e5484d' },
  legalRow: { alignItems: 'center' },
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 999, backgroundColor: '#e5484d' },
  deleteButtonText: { color: '#ffffff' },
});
