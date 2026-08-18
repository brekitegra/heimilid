import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Share, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHousehold } from '@/hooks/use-household';
import { useTheme } from '@/hooks/use-theme';

export default function HouseholdScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = { ...safeAreaInsets, bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three };
  const theme = useTheme();
  const { household, members, leaveHousehold } = useHousehold();
  const [leaving, setLeaving] = useState(false);

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

  async function shareInvite() {
    if (!household) return;
    await Share.share({
      message: `Join our household "${household.name}" on Heimilið! Use invite code: ${household.invite_code}`,
    });
  }

  function confirmLeave() {
    Alert.alert('Leave household', `Leave "${household?.name}"? You'll need the invite code to rejoin.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          setLeaving(true);
          try {
            await leaveHousehold();
          } catch (err) {
            Alert.alert("Couldn't leave household", err instanceof Error ? err.message : 'Something went wrong');
          } finally {
            setLeaving(false);
          }
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{household?.name ?? 'Household'}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.centerText}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.inviteCard}>
          <ThemedText type="small" themeColor="textSecondary">
            Invite code
          </ThemedText>
          <ThemedText type="subtitle" style={styles.inviteCode}>
            {household?.invite_code}
          </ThemedText>
          <Pressable onPress={shareInvite} style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundSelected" style={styles.shareButton}>
              <ThemedText type="linkPrimary">Share invite code</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.membersSection}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            MEMBERS
          </ThemedText>
          {members.map((member) => (
            <ThemedView key={member.user_id} type="backgroundElement" style={styles.memberRow}>
              <ThemedText type="default">{member.profile?.full_name?.trim() || 'Unnamed'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {member.role}
              </ThemedText>
            </ThemedView>
          ))}
        </ThemedView>

        <Pressable disabled={leaving} onPress={confirmLeave} style={({ pressed }) => pressed && styles.pressed}>
          <ThemedText type="link" style={styles.leaveText}>
            {leaving ? 'Leaving…' : 'Leave household'}
          </ThemedText>
        </Pressable>

        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
    gap: Spacing.five,
  },
  titleContainer: {
    gap: Spacing.two,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  inviteCard: {
    marginHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  inviteCode: {
    letterSpacing: 4,
  },
  pressed: {
    opacity: 0.7,
  },
  shareButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginTop: Spacing.one,
  },
  membersSection: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  leaveText: {
    textAlign: 'center',
    color: '#e5484d',
  },
});
