import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSemanticTokens } from './theme';

export type ScreenProps = ViewProps & {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
};

export function Screen({ children, scroll = false, padded = true, style, ...props }: ScreenProps) {
  const tokens = useSemanticTokens();
  const contentStyle = [padded && styles.padded, style];

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: tokens.background.default }]}
      edges={['top', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, padded && styles.padded, style]}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        ) : (
          <View {...props} style={contentStyle}>
            {children}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  padded: {
    padding: 16,
    gap: 16,
  },
});
