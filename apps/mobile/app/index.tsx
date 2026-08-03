import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/providers/auth-provider';
import { useSemanticTokens } from '@pp-planning/ui-mobile';

export default function IndexScreen() {
  const { isBootstrapping, isAuthenticated } = useAuth();
  const tokens = useSemanticTokens();

  if (isBootstrapping) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.background.default,
        }}
      >
        <ActivityIndicator color={tokens.action.primary} size="large" />
      </View>
    );
  }

  if (isAuthenticated) {
    return <Redirect href="/(app)/(tabs)/lancar" />;
  }

  return <Redirect href="/(auth)/login" />;
}
