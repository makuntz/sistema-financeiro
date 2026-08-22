import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Button, Card, Screen, Text, useSemanticTokens } from '@pp-planning/ui-mobile';
import { useAuth, type ThemePreference } from '@/src/providers/auth-provider';

const THEME_OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'Sistema' },
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
];

export default function MaisScreen() {
  const tokens = useSemanticTokens();
  const {
    user,
    workspace,
    workspaces,
    themePreference,
    setThemePreference,
    selectWorkspace,
    logout,
  } = useAuth();

  return (
    <Screen scroll>
      <Text variant="title">Mais</Text>
      <Text tone="secondary">{user?.email}</Text>

      <Card title="Workspace">
        {workspaces.map((item) => {
          const selected = item.workspace.id === workspace?.workspace.id;
          return (
            <Pressable
              key={item.workspace.id}
              accessibilityRole="button"
              onPress={() => void selectWorkspace(item.workspace.id)}
              style={[
                styles.workspaceRow,
                {
                  borderColor: selected ? tokens.action.primary : tokens.border.default,
                  backgroundColor: selected ? tokens.background.subtle : 'transparent',
                },
              ]}
            >
              <Text>{item.workspace.name}</Text>
              {selected ? <Text tone="secondary">Atual</Text> : null}
            </Pressable>
          );
        })}
      </Card>

      <Card title="Tema">
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const selected = themePreference === option.value;
            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                onPress={() => void setThemePreference(option.value)}
                style={[
                  styles.themeChip,
                  {
                    borderColor: selected ? tokens.action.primary : tokens.border.default,
                    backgroundColor: selected ? tokens.action.primary : tokens.surface.default,
                  },
                ]}
              >
                <Text style={{ color: selected ? tokens.text.inverse : tokens.text.primary }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {__DEV__ ? (
        <Card title="Desenvolvimento">
          <Text tone="secondary">
            Spike ML Kit on-device. Use o app PP Planning (Development Build), não o Expo Go.
          </Text>
          <Button
            label="Teste de OCR"
            variant="secondary"
            onPress={() => router.push('/(app)/dev/ocr-test')}
          />
        </Card>
      ) : null}

      <Button
        label="Sair"
        variant="danger"
        onPress={() => {
          void logout().then(() => router.replace('/(auth)/login'));
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  workspaceRow: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
