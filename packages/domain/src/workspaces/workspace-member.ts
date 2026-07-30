import type { WorkspaceRole } from './permissions.js';

export type WorkspaceMemberProps = {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  isActive: boolean;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

export class WorkspaceMember {
  private constructor(private props: WorkspaceMemberProps) {}

  static create(input: {
    id: string;
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
    now?: Date;
  }): WorkspaceMember {
    const now = input.now ?? new Date();

    return new WorkspaceMember({
      id: input.id,
      workspaceId: input.workspaceId,
      userId: input.userId,
      role: input.role,
      isActive: true,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: WorkspaceMemberProps): WorkspaceMember {
    return new WorkspaceMember(props);
  }

  get id(): string {
    return this.props.id;
  }

  get workspaceId(): string {
    return this.props.workspaceId;
  }

  get userId(): string {
    return this.props.userId;
  }

  get role(): WorkspaceRole {
    return this.props.role;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  changeRole(role: WorkspaceRole, now: Date = new Date()): void {
    this.props = {
      ...this.props,
      role,
      updatedAt: now,
    };
  }

  deactivate(now: Date = new Date()): void {
    this.props = {
      ...this.props,
      isActive: false,
      updatedAt: now,
    };
  }

  toProps(): WorkspaceMemberProps {
    return { ...this.props };
  }
}
