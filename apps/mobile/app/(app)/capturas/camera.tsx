import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Button, Screen, Text } from '@pp-planning/ui-mobile';
import { apiClient, uploadReceiptImage } from '@/src/lib/api';
import { preprocessReceiptImage } from '@/src/lib/image-preprocess';

export default function CameraScreen() {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      void requestPermission();
    }
  }, [permission, requestPermission]);

  async function handleUsePhoto(uri: string) {
    setUploading(true);
    setError(null);
    try {
      const processed = await preprocessReceiptImage(uri);
      const capture = await apiClient.createReceiptCapture({});
      await uploadReceiptImage(capture.id, processed);
      await apiClient.processReceiptCapture(capture.id);
      router.replace(`/(app)/capturas/${capture.id}/processando`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar a nota');
      setUploading(false);
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
        {error ? <Text tone="danger">{error}</Text> : null}
        <Button
          label={uploading ? 'Enviando...' : 'Usar foto'}
          disabled={uploading}
          onPress={() => void handleUsePhoto(previewUri)}
        />
        <Button
          label="Tirar outra"
          variant="secondary"
          disabled={uploading}
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
