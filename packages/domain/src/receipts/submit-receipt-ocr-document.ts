import type { ReceiptOcrDocument } from '@pp-planning/contracts';
import { receiptOcrDocumentSchema } from '@pp-planning/contracts';
import { DomainError } from '../shared/domain-error.js';
import { PtBrRetailReceiptParser } from './ocr/pt-br-retail-receipt-parser.js';
import type { ReceiptOcrParser } from './ocr/pt-br-retail-receipt-parser.js';
import type { ApplyExtractionResult } from './receipt-use-cases.js';
import type { ReceiptCaptureRepository } from './repositories.js';
import type { ReceiptCapture } from './receipt-capture.js';
import type { ReceiptItem } from './receipt-item.js';

export class SubmitReceiptOcrDocument {
  constructor(
    private readonly captures: ReceiptCaptureRepository,
    private readonly applyExtraction: ApplyExtractionResult,
    private readonly parser: ReceiptOcrParser = new PtBrRetailReceiptParser(),
  ) {}

  async execute(input: {
    captureId: string;
    workspaceId: string;
    document: ReceiptOcrDocument;
  }): Promise<{ capture: ReceiptCapture; items: ReceiptItem[]; parserDurationMs: number }> {
    const parsedDocument = receiptOcrDocumentSchema.safeParse(input.document);
    if (!parsedDocument.success) {
      throw new DomainError('RECEIPT_OCR_DOCUMENT_INVALID', 'Documento OCR inválido.', {
        issues: parsedDocument.error.issues.map((issue: { message: string }) => issue.message),
      });
    }

    const capture = await this.captures.findById(input.captureId, input.workspaceId);
    if (!capture) {
      throw new DomainError('RECEIPT_CAPTURE_NOT_FOUND', 'Captura não encontrada.');
    }

    if (capture.status === 'confirmed') {
      throw new DomainError(
        'RECEIPT_CAPTURE_ALREADY_CONFIRMED',
        'Esta captura já foi confirmada.',
      );
    }

    if (capture.status === 'review') {
      throw new DomainError(
        'RECEIPT_OCR_ALREADY_APPLIED',
        'O OCR já foi aplicado nesta captura.',
      );
    }

    if (capture.status === 'processing') {
      throw new DomainError(
        'RECEIPT_PROCESSING_IN_PROGRESS',
        'Esta captura já está em processamento.',
      );
    }

    if (capture.status !== 'draft' && capture.status !== 'failed') {
      throw new DomainError(
        'RECEIPT_CAPTURE_INVALID_STATUS',
        'Somente capturas em rascunho ou com falha podem receber OCR.',
        { status: capture.status },
      );
    }

    const now = new Date();
    capture.prepareForOcrExtraction(now);
    await this.captures.save(capture);

    const startedAt = Date.now();
    try {
      const result = this.parser.parse(parsedDocument.data);
      const applied = await this.applyExtraction.execute({
        captureId: input.captureId,
        workspaceId: input.workspaceId,
        result,
        extractionVersion: 'pt-br-retail-v1',
        extractionProvider: 'mlkit',
      });

      return {
        ...applied,
        parserDurationMs: Date.now() - startedAt,
      };
    } catch (error) {
      if (error instanceof DomainError) {
        if (
          error.code === 'RECEIPT_OCR_NO_TEXT' ||
          error.code === 'RECEIPT_OCR_NO_ITEMS' ||
          error.code === 'RECEIPT_PARSER_FAILED'
        ) {
          capture.markFailed(error.code, error.message, new Date());
          await this.captures.save(capture);
        }
        throw error;
      }

      capture.markFailed('RECEIPT_PARSER_FAILED', 'Falha ao interpretar a nota fiscal.', new Date());
      await this.captures.save(capture);
      throw new DomainError('RECEIPT_PARSER_FAILED', 'Falha ao interpretar a nota fiscal.');
    }
  }
}
