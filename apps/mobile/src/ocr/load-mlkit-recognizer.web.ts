import { MlKitUnavailableError, type ReceiptTextRecognizer } from './mlkit-receipt-text-recognizer';

export function loadMlKitReceiptTextRecognizer(): ReceiptTextRecognizer {
  throw new MlKitUnavailableError('ML Kit OCR requer Development Build Android.');
}
