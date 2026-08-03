import { Pressable, StyleSheet, View } from 'react-native';
import type { ReceiptCaptureSummaryDto } from '@pp-planning/contracts';
import { Card, MoneyDisplay, Text, useSemanticTokens } from '@pp-planning/ui-mobile';
import { captureStatusLabel, formatDisplayDate } from '@/src/lib/utils';

type CaptureListItemProps = {
  capture: ReceiptCaptureSummaryDto;
  onPress?: () => void;
};

export function CaptureListItem({ capture, onPress }: CaptureListItemProps) {
  const tokens = useSemanticTokens();

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.meta}>
            <Text variant="subtitle">{capture.merchantName ?? 'Nota sem estabelecimento'}</Text>
            <Text tone="secondary" variant="caption">
              {capture.purchaseDate ? formatDisplayDate(capture.purchaseDate) : 'Data pendente'} ·{' '}
              {captureStatusLabel(capture.status)}
            </Text>
          </View>
          {capture.totalAmountInCents ? (
            <MoneyDisplay cents={capture.totalAmountInCents} tone="expense" />
          ) : (
            <Text tone="secondary">{capture.itemCount} itens</Text>
          )}
        </View>
        <Text tone="secondary" variant="caption" style={{ color: tokens.text.secondary }}>
          {capture.ledgerEntryCount > 0
            ? `${capture.ledgerEntryCount} lançamento(s)`
            : `${capture.itemCount} item(ns)`}
        </Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  meta: {
    flex: 1,
    gap: 4,
  },
});
