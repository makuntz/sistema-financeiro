import type { ReceiptTextRecognizer } from './mlkit-receipt-text-recognizer';

/** Loads ML Kit recognizer at call time (avoids crashing Expo Go on screen mount). */
export function loadMlKitReceiptTextRecognizer(): ReceiptTextRecognizer {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./create-mlkit-recognizer.native') as {
    createMlKitReceiptTextRecognizer: () => ReceiptTextRecognizer;
  };
  return mod.createMlKitReceiptTextRecognizer();
}
