import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { Redirect, router } from 'expo-router';
import { Button, Card, Screen, Text } from '@pp-planning/ui-mobile';
import { isExpoGo } from '@/src/lib/runtime-environment';
import {
  countReceiptOcrStats,
  flattenReceiptOcrLines,
  getReceiptOcrFullText,
  type ReceiptOcrDocument,
  type ReceiptOcrRect,
} from '@/src/ocr/receipt-ocr-document';
import type { ReceiptTextRecognizer } from '@/src/ocr/mlkit-receipt-text-recognizer';
import {
  buildReceiptOcrSpatialPreview,
  DEFAULT_ROW_TOLERANCE_PX,
  getReceiptOcrRectCenterX,
  getReceiptOcrRectCenterY,
  looksLikeBrazilianRetailPrice,
} from '@/src/ocr/receipt-ocr-spatial-preview';

type OcrRunResult = {
  document: ReceiptOcrDocument;
  durationMs: number;
};

function formatRect(frame: ReceiptOcrRect): string {
  const centerX = Math.round(getReceiptOcrRectCenterX(frame));
  const centerY = Math.round(getReceiptOcrRectCenterY(frame));
  return [
    `left: ${Math.round(frame.left)}  top: ${Math.round(frame.top)}`,
    `right: ${Math.round(frame.right)}  bottom: ${Math.round(frame.bottom)}`,
    `centerX: ${centerX}  centerY: ${centerY}`,
  ].join('\n');
}

function formatCompactRect(frame: ReceiptOcrRect): string {
  return `[${Math.round(frame.left)},${Math.round(frame.top)} → ${Math.round(frame.right)},${Math.round(frame.bottom)}]`;
}

export default function OcrTestScreen() {
  if (!__DEV__) {
    return <Redirect href="/(app)/(tabs)/lancar" />;
  }

  const expoGo = isExpoGo();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OcrRunResult | null>(null);

  useEffect(() => {
    return () => {
      setPreviewUri(null);
      setResult(null);
      setError(null);
    };
  }, []);

  async function takePhoto() {
    if (!cameraRef.current) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      setPreviewUri(photo.uri);
      setResult(null);
      setError(null);
    }
  }

  async function pickFromGallery() {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!picked.canceled && picked.assets[0]?.uri) {
      setPreviewUri(picked.assets[0].uri);
      setResult(null);
      setError(null);
    }
  }

  async function runOcr() {
    if (!previewUri || expoGo) {
      return;
    }

    setRunning(true);
    setError(null);
    setResult(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/src/ocr/load-mlkit-recognizer.native') as {
        loadMlKitReceiptTextRecognizer: () => ReceiptTextRecognizer;
      };
      const recognizer = mod.loadMlKitReceiptTextRecognizer();
      const recognition = await recognizer.recognize(previewUri);
      setResult(recognition);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar OCR.');
    } finally {
      setRunning(false);
    }
  }

  function clearResult() {
    setPreviewUri(null);
    setResult(null);
    setError(null);
  }

  const stats = result ? countReceiptOcrStats(result.document) : null;
  const fullText = result ? getReceiptOcrFullText(result.document) : '';
  const lines = result ? flattenReceiptOcrLines(result.document) : [];
  const spatialRows = result ? buildReceiptOcrSpatialPreview(result.document) : [];
  const pairedRows = spatialRows.filter((row) => row.price !== null);

  if (expoGo) {
    return (
      <Screen scroll>
        <Text variant="title">Teste de OCR</Text>
        <Card title="Expo Go não suportado">
          <Text tone="danger">
            O ML Kit exige um Development Build (app nativo PP Planning). O Expo Go não inclui o
            módulo RNMLKitTextRecognition.
          </Text>
          <Text tone="secondary" style={styles.paragraph}>
            Feche o Expo Go e use o app PP Planning instalado via:
          </Text>
          <Text selectable style={styles.mono}>
            cd apps/mobile{'\n'}pnpm android:build{'\n'}pnpm dev:client
          </Text>
        </Card>
        <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll padded={false}>
      <View style={styles.header}>
        <Text variant="title">Teste de OCR</Text>
        <Text tone="secondary">
          ML Kit on-device (Latin). Somente desenvolvimento. Nada é enviado à API.
        </Text>
        <Text tone="secondary">Plataforma: {Platform.OS}</Text>
      </View>

      {!permission ? (
        <ActivityIndicator style={styles.loader} />
      ) : !permission.granted ? (
        <View style={styles.section}>
          <Button label="Permitir câmera" onPress={() => void requestPermission()} />
          <Button label="Escolher da galeria" variant="secondary" onPress={() => void pickFromGallery()} />
        </View>
      ) : !previewUri ? (
        <View style={styles.cameraSection}>
          <CameraView ref={cameraRef} style={styles.camera} facing="back" />
          <View style={styles.section}>
            <Button label="Tirar foto" onPress={() => void takePhoto()} />
            <Button label="Galeria" variant="secondary" onPress={() => void pickFromGallery()} />
            <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
          <View style={styles.actions}>
            <Button
              label={running ? 'Lendo...' : 'Executar OCR'}
              disabled={running}
              onPress={() => void runOcr()}
            />
            <Button label="Limpar resultado" variant="secondary" disabled={running} onPress={clearResult} />
            <Button label="Tirar outra" variant="secondary" disabled={running} onPress={clearResult} />
          </View>

          {error ? <Text tone="danger">{error}</Text> : null}

          {result ? (
            <Card title="Resumo">
              <Text>Tempo do OCR: {result.durationMs} ms</Text>
              <Text>Blocos: {stats?.blockCount ?? 0}</Text>
              <Text>Linhas: {stats?.lineCount ?? 0}</Text>
              <Text>Elementos: {stats?.elementCount ?? 0}</Text>
            </Card>
          ) : null}

          {result ? (
            <Card title="Agrupamento espacial (Y)">
              <Text tone="secondary">
                Linhas com centerY parecido (±{DEFAULT_ROW_TOLERANCE_PX}px) são agrupadas na mesma
                fileira. Pares descrição → preço são uma heurística de preview, não o parser final.
              </Text>
              <Text>
                Fileiras: {spatialRows.length} · Pares detectados: {pairedRows.length}
              </Text>
              <ScrollView nestedScrollEnabled style={styles.linesScroll}>
                {spatialRows.map((row) => (
                  <View key={`row-${row.rowIndex}`} style={styles.lineBlock}>
                    <Text variant="subtitle">
                      Fileira {row.rowIndex + 1} · centerY ≈ {Math.round(row.centerY)}
                    </Text>
                    <Text selectable style={row.price ? styles.previewPair : undefined}>
                      {row.preview}
                    </Text>
                    <Text tone="secondary">
                      Linhas na fileira: {row.lines.map((line) => `"${line.text}"`).join(' + ')}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </Card>
          ) : null}

          {result ? (
            <Card title="Texto reconhecido">
              <Text selectable>{fullText || '(vazio)'}</Text>
            </Card>
          ) : null}

          {result ? (
            <Card title="Linhas e elementos">
              <ScrollView nestedScrollEnabled style={styles.linesScroll}>
                {lines.map((line, index) => {
                  const lineCenterY = Math.round(getReceiptOcrRectCenterY(line.frame));
                  const elements =
                    line.elements.length > 0
                      ? line.elements
                      : [{ text: line.text, frame: line.frame }];

                  return (
                    <View key={`line-${index}`} style={styles.lineBlock}>
                      <Text variant="subtitle">
                        Linha {index + 1} · centerY {lineCenterY} · {elements.length} elemento(s)
                      </Text>
                      <Text>Texto:</Text>
                      <Text selectable>{line.text}</Text>
                      <Text tone="secondary">Bounding box da linha:</Text>
                      <Text selectable style={styles.mono}>
                        {formatRect(line.frame)}
                      </Text>
                      {elements.map((element, elementIndex) => (
                        <View key={`line-${index}-element-${elementIndex}`} style={styles.elementBlock}>
                          <Text tone="secondary">
                            Elemento {elementIndex + 1}
                            {looksLikeBrazilianRetailPrice(element.text) ? ' · preço?' : ''}
                          </Text>
                          <Text selectable>{element.text}</Text>
                          <Text selectable style={styles.mono}>
                            {formatCompactRect(element.frame)} centerY{' '}
                            {Math.round(getReceiptOcrRectCenterY(element.frame))}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </ScrollView>
            </Card>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: 16,
    gap: 8,
  },
  section: {
    padding: 16,
    gap: 12,
  },
  paragraph: {
    marginTop: 8,
  },
  cameraSection: {
    flex: 1,
    minHeight: 520,
  },
  camera: {
    height: 360,
  },
  preview: {
    width: '100%',
    height: 320,
    borderRadius: 12,
  },
  actions: {
    gap: 12,
  },
  loader: {
    marginTop: 24,
  },
  linesScroll: {
    maxHeight: 420,
  },
  lineBlock: {
    gap: 4,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#cbd5e1',
  },
  elementBlock: {
    gap: 2,
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 2,
    borderLeftColor: '#94a3b8',
  },
  previewPair: {
    fontWeight: '600',
  },
  mono: {
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
  },
});
