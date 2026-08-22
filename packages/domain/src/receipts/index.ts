export {
  ReceiptCapture,
  type ReceiptCaptureStatus,
  type ReceiptCaptureProps,
} from './receipt-capture.js';
export { ReceiptItem, type ReceiptItemProps } from './receipt-item.js';
export {
  type ReceiptExtractor,
  FakeReceiptExtractor,
  createReceiptExtractor,
  validateExtractionResult,
  sumNonIgnoredLineTotals,
  totalDifferenceCents,
  isWithinTotalTolerance,
  groupItemsBySubcategory,
  assertReadyForConfirmation,
  type ReceiptSubcategoryGroup,
} from './receipt-extractor.js';
export type {
  ReceiptCaptureRepository,
  ReceiptItemRepository,
  ReceiptImageRepository,
  ReceiptProcessingJobRepository,
  ReceiptConfirmationStore,
  ReceiptImageRecord,
  ReceiptProcessingJobRecord,
  ConfirmedLedgerDraft,
} from './repositories.js';
export {
  ConfirmReceiptCapture,
  BulkAssignReceiptItems,
  BulkIgnoreReceiptItems,
  type ReceiptSubcategoryLookup,
  type SubcategoryForReceipt,
} from './confirm-receipt-capture.js';
export {
  CreateReceiptCapture,
  RequestReceiptImageUploadUrl,
  CompleteReceiptImageUpload,
  ProcessReceiptCapture,
  ApplyExtractionResult,
  UpdateReceiptCapture,
  UpdateReceiptItem,
  ReprocessReceiptCapture,
  GetReceiptCapture,
  type ReceiptUploadUrlPort,
  type ReceiptImageLimits,
} from './receipt-use-cases.js';
export { SubmitReceiptOcrDocument } from './submit-receipt-ocr-document.js';
export { AddReceiptItem } from './add-receipt-item.js';
export {
  PtBrRetailReceiptParser,
  buildOcrDocumentFromLines,
  type ReceiptOcrParser,
} from './ocr/pt-br-retail-receipt-parser.js';
export {
  normalizeOcrText,
  canonicalizeForMatching,
  removeItemPrefixTokens,
} from './ocr/normalize.js';
export {
  parseBrazilianMoneyToCents,
  extractMoneyCandidates,
  looksLikeMoneyText,
} from './ocr/money-parser.js';
export { extractPurchaseDate } from './ocr/date-parser.js';
export {
  getCenterX,
  getCenterY,
  groupLinesByRow,
  buildSpatialContext,
} from './ocr/spatial.js';
