import { Platform } from 'react-native';
import { recognizeText } from '@infinitered/react-native-mlkit-text-recognition';
import { mapMlKitTextToDocument } from './receipt-ocr-document';
import {
  MlKitUnavailableError,
  type ReceiptOcrRecognitionResult,
  type ReceiptTextRecognizer,
} from './mlkit-receipt-text-recognizer';

export class MlKitReceiptTextRecognizer implements ReceiptTextRecognizer {
  async recognize(imageUri: string): Promise<ReceiptOcrRecognitionResult> {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') {
      throw new MlKitUnavailableError('ML Kit OCR só está disponível em Android/iOS nativo.');
    }

    const startedAt = Date.now();
    const result = await recognizeText(imageUri);
    const durationMs = Date.now() - startedAt;

    const document = mapMlKitTextToDocument({
      text: result.text,
      blocks: result.blocks,
      platform: Platform.OS === 'ios' ? 'ios' : 'android',
      engineVersion: null,
    });

    return { document, durationMs };
  }
}

export function createMlKitReceiptTextRecognizer(): ReceiptTextRecognizer {
  return new MlKitReceiptTextRecognizer();
}
