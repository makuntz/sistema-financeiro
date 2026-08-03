import { useCallback, useEffect, useState } from 'react';
import type { ReceiptCaptureDto } from '@pp-planning/contracts';
import { apiClient } from '@/src/lib/api';

export function useReceiptCapture(captureId: string | undefined) {
  const [capture, setCapture] = useState<ReceiptCaptureDto | null>(null);
  const [loading, setLoading] = useState(Boolean(captureId));
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!captureId) {
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getReceiptCapture(captureId);
      setCapture(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar captura');
      return null;
    } finally {
      setLoading(false);
    }
  }, [captureId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { capture, loading, error, reload, setCapture };
}
