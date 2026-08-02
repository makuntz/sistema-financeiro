import { Tabs } from 'expo-router';
import { useSemanticTokens } from '@pp-planning/ui-mobile';

export default function TabsLayout() {
  const tokens = useSemanticTokens();

  return (
    <Tabs
      initialRouteName="lancar"
      screenOptions={{
        headerStyle: { backgroundColor: tokens.background.default },
        headerTintColor: tokens.text.primary,
        tabBarStyle: {
          backgroundColor: tokens.surface.default,
          borderTopColor: tokens.border.default,
        },
        tabBarActiveTintColor: tokens.action.primary,
        tabBarInactiveTintColor: tokens.text.secondary,
      }}
    >
      <Tabs.Screen
        name="lancar"
        options={{
          title: 'Lançar',
          tabBarLabel: 'Lançar',
        }}
      />
      <Tabs.Screen
        name="historico"
        options={{
          title: 'Histórico',
          tabBarLabel: 'Histórico',
        }}
      />
      <Tabs.Screen
        name="mais"
        options={{
          title: 'Mais',
          tabBarLabel: 'Mais',
        }}
      />
    </Tabs>
  );
}
