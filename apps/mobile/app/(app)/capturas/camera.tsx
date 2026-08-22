import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Button, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient } from '@/src/lib/api';
import { isExpoGo } from '@/src/lib/runtime-environment';
import type { ReceiptTextRecognizer } from '@/src/ocr/mlkit-receipt-text-recognizer';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const expoGo = isExpoGo();

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function handleReadReceipt(uri: string) {
    if (expoGo) {
      setError('O OCR local exige o Development Build PP Planning. O Expo Go não suporta ML Kit.');
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('@/src/ocr/load-mlkit-recognizer.native') as {
        loadMlKitReceiptTextRecognizer: () => ReceiptTextRecognizer;
      };
      const recognizer = mod.loadMlKitReceiptTextRecognizer();
      const { document } = await recognizer.recognize(uri);

      const capture = await apiClient.createReceiptCapture({
        extractionProvider: 'mlkit',
      });
      const reviewed = await apiClient.submitReceiptOcrDocument(capture.id, { document });
      router.replace(`/(app)/capturas/${reviewed.id}/conferir`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ler a nota');
      setProcessing(false);
    }
  }

  async function takePhoto() {
    if (!cameraRef.current) {
      return;
    }
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
    if (photo?.uri) {
      setPreviewUri(photo.uri);
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPreviewUri(result.assets[0].uri);
    }
  }

  if (!permission) {
    return (
      <Screen>
        <ActivityIndicator />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen scroll>
        <Text variant="title">Permissão da câmera</Text>
        <Text tone="secondary">Precisamos de acesso à câmera para escanear notas fiscais.</Text>
        <Button label="Permitir câmera" onPress={() => void requestPermission()} />
        <Button
          label="Escolher da galeria"
          variant="secondary"
          onPress={() => void pickFromGallery()}
        />
      </Screen>
    );
  }

  if (previewUri) {
    return (
      <Screen scroll>
        <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
        <Text tone="secondary">
          A foto permanece no aparelho. Somente o texto reconhecido é enviado à API.
        </Text>
        {error ? <Text tone="danger">{error}</Text> : null}
        <Button
          label={processing ? 'Lendo nota...' : 'Ler nota'}
          disabled={processing || expoGo}
          onPress={() => void handleReadReceipt(previewUri)}
        />
        <Button
          label="Tirar outra"
          variant="secondary"
          disabled={processing}
          onPress={() => {
            setPreviewUri(null);
            setError(null);
          }}
        />
      </Screen>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing="back" />
      <View style={styles.controls}>
        <Text tone="secondary" variant="caption">
          {Platform.OS === 'android' ? 'ML Kit on-device' : 'OCR local'} · sem upload de imagem
        </Text>
        <Button label="Capturar" onPress={() => void takePhoto()} />
        <Button label="Galeria" variant="secondary" onPress={() => void pickFromGallery()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  devPanel: {
    padding: 12,
    paddingBottom: 0,
  },
  camera: {
    flex: 1,
  },
  controls: {
    padding: 16,
    gap: 12,
  },
  preview: {
    width: '100%',
    height: 360,
    borderRadius: 12,
  },
});
