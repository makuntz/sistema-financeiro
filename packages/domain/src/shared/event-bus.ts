export type DomainEvent = {
  name: string;
  occurredAt: Date;
  payload: Record<string, unknown>;
};

export interface EventBus {
  publish(event: DomainEvent): Promise<void>;
  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void> | void): void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Array<(event: DomainEvent) => Promise<void> | void>>();

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.name) ?? [];

    for (const handler of handlers) {
      await handler(event);
    }
  }

  subscribe(eventName: string, handler: (event: DomainEvent) => Promise<void> | void): void {
    const current = this.handlers.get(eventName) ?? [];
    current.push(handler);
    this.handlers.set(eventName, current);
  }
}
