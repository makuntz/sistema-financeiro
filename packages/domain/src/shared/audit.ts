export type AuditEventName =
  | 'InvitationCreated'
  | 'InvitationRevoked'
  | 'InvitationAccepted'
  | 'InvitationDeclined'
  | 'MembershipCreated'
  | 'MembershipRoleChanged'
  | 'MembershipDeactivated'
  | 'MemberLeftWorkspace'
  | 'OwnerAdded'
  | 'WorkspaceCreated'
  | 'UserRegistered'
  | 'UserLoggedIn'
  | 'SessionRefreshed'
  | 'SessionRevoked'
  | 'WorkspaceAccessDenied'
  | 'MonthlyPlanCreated'
  | 'MonthlyPlanUpdated'
  | 'MonthlyPlanCopiedFromPreviousMonth'
  | 'LedgerEntryCreated'
  | 'LedgerEntryUpdated'
  | 'LedgerEntryVoided'
  | 'LedgerEntryRestored'
  | 'ReceiptCaptureCreated'
  | 'ReceiptImageUploadRequested'
  | 'ReceiptImageUploaded'
  | 'ReceiptProcessingStarted'
  | 'ReceiptProcessingCompleted'
  | 'ReceiptProcessingFailed'
  | 'ReceiptCaptureUpdated'
  | 'ReceiptItemUpdated'
  | 'ReceiptItemsBulkAssigned'
  | 'ReceiptItemsBulkIgnored'
  | 'ReceiptCaptureConfirmed'
  | 'LedgerEntriesCreatedFromReceipt';

export type AuditEvent = {
  name: AuditEventName;
  actorUserId?: string;
  workspaceId?: string;
  occurredAt: Date;
  payload: Record<string, string | number | boolean | null | string[]>;
};

export interface AuditLogger {
  record(event: AuditEvent): Promise<void>;
}

export class InMemoryAuditLogger implements AuditLogger {
  readonly events: AuditEvent[] = [];

  async record(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }
}
