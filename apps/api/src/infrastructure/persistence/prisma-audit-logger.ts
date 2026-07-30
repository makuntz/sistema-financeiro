import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@pp-planning/database';
import type { AuditLogger, AuditEvent } from '@pp-planning/domain';

export class PrismaAuditLogger implements AuditLogger {
  constructor(private readonly prisma: PrismaClient) {}

  async record(event: AuditEvent): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        id: randomUUID(),
        name: event.name,
        actorUserId: event.actorUserId ?? null,
        workspaceId: event.workspaceId ?? null,
        payload: event.payload,
        occurredAt: event.occurredAt,
      },
    });
  }
}
