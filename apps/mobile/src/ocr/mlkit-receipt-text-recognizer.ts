import type { ReceiptOcrDocument } from './receipt-ocr-document';

export type ReceiptOcrRecognitionResult = {
  document: ReceiptOcrDocument;
  durationMs: number;
};

export type ReceiptTextRecognizer = {
  recognize(imageUri: string): Promise<ReceiptOcrRecognitionResult>;
};

export class MlKitUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MlKitUnavailableError';
  }
}
