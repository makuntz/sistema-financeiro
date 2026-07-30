'use client';

import { AppShell } from '../../components/app-shell';
import { UnsavedChangesProvider } from '../../components/unsaved-changes';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <AppShell>{children}</AppShell>
    </UnsavedChangesProvider>
  );
}
