'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ConfirmDialog } from '@pp-planning/ui-web';

type UnsavedChangesContextValue = {
  setDirty: (dirty: boolean) => void;
  confirmIfDirty: (action: () => void | Promise<void>) => void;
  isDirty: boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setIsDirty] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const pendingAction = useRef<(() => void | Promise<void>) | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirty(dirty);
  }, []);

  const confirmIfDirty = useCallback(
    (action: () => void | Promise<void>) => {
      if (!isDirty) {
        void action();
        return;
      }
      pendingAction.current = action;
      setPendingOpen(true);
    },
    [isDirty],
  );

  const value = useMemo(
    () => ({ setDirty, confirmIfDirty, isDirty }),
    [setDirty, confirmIfDirty, isDirty],
  );

  return (
    <UnsavedChangesContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pendingOpen}
        onClose={() => {
          setPendingOpen(false);
          pendingAction.current = null;
        }}
        onConfirm={() => {
          const action = pendingAction.current;
          setPendingOpen(false);
          pendingAction.current = null;
          setIsDirty(false);
          if (action) void action();
        }}
        title="Alterações não salvas"
        description="Você possui alterações não salvas. Deseja descartá-las?"
        confirmLabel="Descartar"
        cancelLabel="Continuar editando"
        tone="danger"
      />
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges(): UnsavedChangesContextValue {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    return {
      setDirty: () => undefined,
      confirmIfDirty: (action) => {
        void action();
      },
      isDirty: false,
    };
  }
  return ctx;
}
