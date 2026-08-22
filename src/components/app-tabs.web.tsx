import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { QuickMenu } from '@/components/quick-menu';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';

export default function AppTabs() {
  const t = useTranslation();

  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>{t('tabHome')}</TabButton>
          </TabTrigger>
          <TabTrigger name="household" href="/household" asChild>
            <TabButton>{t('tabHousehold')}</TabButton>
          </TabTrigger>
          <TabTrigger name="notes" href="/notes" asChild>
            <TabButton>{t('tabNotes')}</TabButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <TabButton>{t('tabProfile')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="default" themeColor={isFocused ? 'text' : 'textSecondary'} style={styles.tabButtonText}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    // A real ThemedView (opaque, matching the page background), not a
    // plain transparent View — the tab bar sits position: absolute over
    // scrollable page content, and only the pill itself used to have a
    // background. Once the pill was enlarged, scrolling any screen made
    // page content visibly pass through the gaps beside the pill (the
    // "gutters"), reading as broken overlap instead of content cleanly
    // hidden behind a header. A full-width opaque strip fixes that at
    // the root: whatever scrolls up now genuinely disappears behind the
    // whole bar, not just behind the pill's own footprint.
    <ThemedView {...props} style={styles.tabListContainer}>
      {/* One centered pill holding everything — tabs and the quick-menu
          both live inside the same rounded row now (user asked for the
          ⋮ to genuinely be "in the bar" rather than a separate corner
          circle). QuickMenu sits as a sibling *after* the ScrollView, not
          inside it: a ScrollView clips any child — including an
          absolutely positioned dropdown — that renders past its own
          bounds, which would cut off the quick-menu's popup if it lived
          inside the scrolling tab row. Being a plain View, innerContainer
          itself doesn't clip, so the dropdown escapes cleanly from here. */}
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabScrollContent}>
          {props.children}
        </ScrollView>
        <QuickMenu />
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  innerContainer: {
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    // No flexGrow here (0 is the default) — this pill shrink-wraps to its
    // content so tabListContainer's justifyContent: 'center' actually
    // centers a compact pill, instead of the pill stretching to fill the
    // whole row and pinning its content to one side.
    // flexShrink: 1 + minWidth: 0 — RN defaults flexShrink to 0 for a
    // plain View (unlike raw CSS, which defaults flex-shrink to 1), so
    // without setting it explicitly this row never shrinks at all no
    // matter what minWidth says, and just overflows the container's
    // bounds instead of ever handing tabScroll a constrained width to
    // shrink within.
    flexShrink: 1,
    minWidth: 0,
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
  },
  // Lets the tab row scroll horizontally instead of clipping/overflowing
  // once there are enough items (4 tabs) to no longer fit at mobile
  // widths — same pattern every pill row elsewhere in this app already
  // uses for the same reason. minWidth: 0 is the actual fix — web's
  // default min-width:auto on flex items means flexShrink alone won't
  // shrink this below its content's natural width (the same gotcha
  // paired TextInputs hit earlier this session). The quick-menu icon
  // sits outside this ScrollView (see CustomTabList above) so it never
  // scrolls away with the tabs.
  tabScroll: {
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
  },
  tabScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  tabButtonText: {
    fontSize: 17,
  },
});
