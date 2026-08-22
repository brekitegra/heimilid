import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Colors } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-language';
import { useResolvedColorScheme } from '@/hooks/use-resolved-color-scheme';

export default function AppTabs() {
  const scheme = useResolvedColorScheme();
  const colors = Colors[scheme];
  const t = useTranslation();

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('tabHome')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={require('@/assets/images/tabIcons/home.png')}
          renderingMode="template"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="household">
        <NativeTabs.Trigger.Label>{t('tabHousehold')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.2', selected: 'person.2.fill' }}
          md="people"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notes">
        <NativeTabs.Trigger.Label>{t('tabNotes')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'note.text', selected: 'note.text' }}
          md="note"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('tabProfile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
