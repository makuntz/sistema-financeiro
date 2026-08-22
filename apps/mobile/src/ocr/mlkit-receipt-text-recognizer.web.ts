import {
  MlKitUnavailableError,
  type ReceiptTextRecognizer,
} from './mlkit-receipt-text-recognizer';

export class MlKitReceiptTextRecognizer implements ReceiptTextRecognizer {
  async recognize(): Promise<never> {
    throw new MlKitUnavailableError(
      'ML Kit OCR requer Development Build Android. Não funciona na web.',
    );
  }
}

export function createMlKitReceiptTextRecognizer(): ReceiptTextRecognizer {
  return new MlKitReceiptTextRecognizer();
}
