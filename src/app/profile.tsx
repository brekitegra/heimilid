import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { CollapsibleCard } from '@/components/collapsible-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { XpProgressBar } from '@/components/xp-progress-bar';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference, type ThemePreference } from '@/hooks/use-theme-preference';
import { showAlert } from '@/lib/alert';
import { formatKennitala, isValidKennitala } from '@/lib/kennitala';
import { shareHouseholdInvite } from '@/lib/share-invite';
import { levelForXp, rankBadge, sortMembersByXp, xpProgressForLevel } from '@/lib/xp';

const APPEARANCE_OPTIONS: { key: ThemePreference; label: string }[] = [
  { key: 'system', label: 'System' },
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = { ...safeAreaInsets, bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three };
  const theme = useTheme();
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

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [kennitala, setKennitala] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

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

  // Seed the form once the profile actually loads (keyed on id so a later
  // re-fetch from our own save/avatar-upload doesn't stomp on further edits
  // the person is mid-way through typing).
  useEffect(() => {
    if (!profile) return;
    // Seeding local edit state from a freshly (re)loaded profile, not
    // synchronizing with an external system on every render.
    /* eslint-disable react-hooks/set-state-in-effect */
    setFullName(profile.full_name ?? '');
    setPhone(profile.phone ?? '');
    setKennitala(profile.kennitala ?? '');
    /* eslint-enable react-hooks/set-state-in-effect */
    // Deliberately keyed on id only — a re-fetch after our own save
    // shouldn't stomp on further edits the person is mid-way through typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const kennitalaError = kennitala.trim().length > 0 && !isValidKennitala(kennitala);
  const isDirty =
    !!profile &&
    (fullName.trim() !== (profile.full_name ?? '') ||
      phone.trim() !== (profile.phone ?? '') ||
      kennitala.trim() !== (profile.kennitala ?? ''));

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

  async function handleSave() {
    if (kennitalaError) {
      showAlert('Check your kennitala', "That doesn't look like a valid kennitala.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        full_name: fullName.trim() || null,
        phone: phone.trim() || null,
        kennitala: kennitala.trim() || null,
      });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      showAlert("Couldn't save", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSaving(false);
    }
  }

  function discardAboutYouChanges() {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setPhone(profile.phone ?? '');
    setKennitala(profile.kennitala ?? '');
  }

  async function handleChangePassword() {
    if (newPassword.length < 6) {
      showAlert('Password too short', 'Use at least 6 characters.');
      return;
    }
    if (!passwordsMatch) {
      showAlert("Passwords don't match", 'Double-check the new password and its confirmation.');
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
      showAlert("Couldn't change password", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleChangeAvatar() {
    try {
      await pickAndUploadAvatar();
    } catch (err) {
      showAlert("Couldn't update photo", err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  function confirmRemoveAvatar() {
    showAlert('Remove photo', 'Go back to a plain initials icon?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setRemovingAvatar(true);
          try {
            await removeAvatar();
          } catch (err) {
            showAlert("Couldn't remove photo", err instanceof Error ? err.message : 'Something went wrong');
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
      showAlert('Check your inbox', `We've sent a confirmation link to ${trimmed}. Your email stays the same until you click it.`);
    } catch (err) {
      showAlert("Couldn't change email", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSendingEmailChange(false);
    }
  }

  async function shareInvite() {
    if (!household) return;
    await shareHouseholdInvite(household);
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
      showAlert("Couldn't rename household", err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRenamingHousehold(false);
    }
  }

  function confirmRemoveMember(memberName: string, userId: string) {
    showAlert('Remove member', `Remove ${memberName} from the household? They'll need the invite code to rejoin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeMember(userId);
          } catch (err) {
            showAlert("Couldn't remove member", err instanceof Error ? err.message : 'Something went wrong');
          }
        },
      },
    ]);
  }

  function confirmPromoteToOwner(memberName: string, userId: string) {
    showAlert('Make owner', `Make ${memberName} an owner? They'll be able to rename the household and remove members too.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Make owner',
        onPress: async () => {
          try {
            await promoteToOwner(userId);
          } catch (err) {
            showAlert("Couldn't update role", err instanceof Error ? err.message : 'Something went wrong');
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
      showAlert("Couldn't delete account", err instanceof Error ? err.message : 'Something went wrong');
      setDeletingAccount(false);
    }
  }

  function confirmLogOut() {
    showAlert('Log out', 'You can always sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try {
            await signOut();
          } catch (err) {
            showAlert("Couldn't log out", err instanceof Error ? err.message : 'Something went wrong');
            setLoggingOut(false);
          }
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
      paddingTop: Spacing.six,
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
            {profile?.full_name?.trim() || 'Unnamed'}
          </ThemedText>

          {editingEmail ? (
            <View style={styles.emailEditRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.emailInput,
                  { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected, color: theme.text },
                ]}
                placeholder="Email address"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                value={emailDraft}
                onChangeText={setEmailDraft}
                autoFocus
              />
              <Pressable disabled={sendingEmailChange} onPress={sendEmailChange} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="accent">
                  {sendingEmailChange ? '…' : 'Send'}
                </ThemedText>
              </Pressable>
              <Pressable disabled={sendingEmailChange} onPress={() => setEditingEmail(false)} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  Cancel
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
                {removingAvatar ? 'Removing…' : 'Remove photo'}
              </ThemedText>
            </Pressable>
          )}

          <View style={styles.xpBlock}>
            <View style={styles.xpLabelRow}>
              <ThemedText type="smallBold">Level {level}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {xpIntoLevel}/{xpForNextLevel} XP
              </ThemedText>
            </View>
            <XpProgressBar xp={xp} />
          </View>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            ABOUT YOU
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Name
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder="Your name"
              placeholderTextColor={theme.textSecondary}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Phone
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder="Phone number"
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary">
              Kennitala
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.background, borderColor: kennitalaError ? '#e5484d' : theme.backgroundSelected, color: theme.text },
              ]}
              placeholder="DDMMYY-XXXX"
              placeholderTextColor={theme.textSecondary}
              keyboardType="number-pad"
              value={kennitala}
              onChangeText={(text) => setKennitala(formatKennitala(text))}
              maxLength={11}
            />
            {kennitalaError && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                That doesn&apos;t look like a valid kennitala.
              </ThemedText>
            )}
          </View>

          <View style={styles.saveRow}>
            <Pressable
              disabled={!isDirty || saving || kennitalaError}
              onPress={handleSave}
              style={({ pressed }) => [styles.saveRowButton, pressed && styles.pressed]}>
              <ThemedView
                type="backgroundSelected"
                style={[styles.saveButton, (!isDirty || kennitalaError) && !saving && styles.saveButtonDisabled]}>
                {saving ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <ThemedText type="smallBold">{justSaved ? 'Saved ✓' : 'Save changes'}</ThemedText>
                )}
              </ThemedView>
            </Pressable>
            {isDirty && !saving && (
              <Pressable onPress={discardAboutYouChanges} hitSlop={8}>
                <ThemedText type="small" themeColor="textSecondary">
                  Discard
                </ThemedText>
              </Pressable>
            )}
          </View>
        </ThemedView>

        <CollapsibleCard title="PASSWORD">
          <View style={styles.field}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder="Current password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={currentPassword}
              onChangeText={setCurrentPassword}
            />
          </View>
          <View style={styles.field}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
              placeholder="New password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={newPassword}
              onChangeText={setNewPassword}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={newPassword.length > 0 && newPassword.length < 6 && styles.errorText}>
              At least 6 characters
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
              placeholder="Confirm new password"
              placeholderTextColor={theme.textSecondary}
              secureTextEntry={!showPasswords}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
            {confirmPassword.length > 0 && !passwordsMatch && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
                Passwords don&apos;t match.
              </ThemedText>
            )}
          </View>

          <Pressable onPress={() => setShowPasswords((v) => !v)} hitSlop={8} style={styles.showPasswordsRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {showPasswords ? 'Hide passwords' : 'Show passwords'}
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
                <ThemedText type="smallBold">{passwordJustChanged ? 'Updated ✓' : 'Update password'}</ThemedText>
              )}
            </ThemedView>
          </Pressable>
        </CollapsibleCard>

        <CollapsibleCard title="APPEARANCE">
          <View style={styles.appearanceRow}>
            {APPEARANCE_OPTIONS.map((option) => {
              const active = preference === option.key;
              return (
                <Pressable key={option.key} onPress={() => setPreference(option.key)} style={styles.appearanceOption}>
                  <ThemedView
                    type={active ? 'backgroundSelected' : 'background'}
                    style={[styles.appearancePill, active && { borderColor: theme.accent, borderWidth: 1 }]}>
                    <ThemedText type="small" themeColor={active ? 'text' : 'textSecondary'}>
                      {option.label}
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
              HOUSEHOLD
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
                    {renamingHousehold ? '…' : 'Save'}
                  </ThemedText>
                </Pressable>
                <Pressable disabled={renamingHousehold} onPress={() => setEditingHouseholdName(false)} hitSlop={8}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Cancel
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
                  Invite code
                </ThemedText>
                <ThemedText type="smallBold" style={styles.inviteCode}>
                  {household.invite_code}
                </ThemedText>
              </View>
              <Pressable onPress={shareInvite} style={({ pressed }) => pressed && styles.pressed}>
                <ThemedView type="backgroundSelected" style={styles.shareButton}>
                  <ThemedText type="linkPrimary">Share</ThemedText>
                </ThemedView>
              </Pressable>
            </ThemedView>

            <View style={styles.memberList}>
              <ThemedText type="small" themeColor="textSecondary">
                {members.length >= 2 ? 'LEADERBOARD' : 'YOUR HOUSEHOLD'}
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
                        {member.profile?.full_name?.trim() || 'Unnamed'}
                        {isSelf ? ' (you)' : ''}
                        {member.role === 'owner' ? ' · Owner' : ''}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Level {levelForXp(member.profile?.xp ?? 0)}
                      </ThemedText>
                    </View>
                    {isOwner && !isSelf && (
                      <View style={styles.memberActions}>
                        {member.role !== 'owner' && (
                          <Pressable
                            onPress={() => confirmPromoteToOwner(member.profile?.full_name?.trim() || 'this member', member.user_id)}
                            hitSlop={8}>
                            <ThemedText type="small" themeColor="accent">
                              Make owner
                            </ThemedText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => confirmRemoveMember(member.profile?.full_name?.trim() || 'this member', member.user_id)}
                          hitSlop={8}
                          style={({ pressed }) => pressed && styles.pressed}>
                          <ThemedView type="backgroundSelected" style={styles.removeButton}>
                            <ThemedText type="small" style={styles.removeText}>
                              Remove
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

        <Pressable disabled={loggingOut} onPress={confirmLogOut} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="link" style={styles.logOutText}>
            {loggingOut ? 'Logging out…' : 'Log out'}
          </ThemedText>
        </Pressable>

        <CollapsibleCard title="DANGER ZONE">
          <ThemedText type="small" themeColor="textSecondary">
            Permanently deletes your account and profile. This can&apos;t be undone.
          </ThemedText>

          {wouldOrphanHousehold ? (
            <ThemedText type="small" style={styles.errorText}>
              You&apos;re the only owner of &quot;{household?.name}&quot; and other people are still in it. Make someone
              else an owner first (in the leaderboard above) so the household isn&apos;t left without one.
            </ThemedText>
          ) : (
            <>
              <View style={styles.field}>
                <ThemedText type="small" themeColor="textSecondary">
                  Type DELETE to confirm
                </ThemedText>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.background, borderColor: theme.backgroundSelected, color: theme.text }]}
                  placeholder="DELETE"
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
                      Delete my account forever
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
  container: { maxWidth: MaxContentWidth, flexGrow: 1, gap: Spacing.four, paddingHorizontal: Spacing.four },
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
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  saveRowButton: { flex: 1 },
  showPasswordsRow: { alignSelf: 'flex-start' },
  appearanceRow: { flexDirection: 'row', gap: Spacing.two },
  appearanceOption: { flex: 1 },
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
  deleteButton: { alignItems: 'center', paddingVertical: Spacing.three, borderRadius: 999, backgroundColor: '#e5484d' },
  deleteButtonText: { color: '#ffffff' },
});
