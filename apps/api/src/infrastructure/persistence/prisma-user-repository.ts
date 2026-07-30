import type { PrismaClient } from '@pp-planning/database';
import { User, type UserRepository } from '@pp-planning/domain';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? this.toDomain(row) : null;
  }

  async findByNormalizedEmail(normalizedEmail: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { normalizedEmail },
    });
    return row ? this.toDomain(row) : null;
  }

  async save(user: User): Promise<void> {
    const props = user.toProps();

    await this.prisma.user.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        name: props.name,
        email: props.email,
        normalizedEmail: props.normalizedEmail,
        passwordHash: props.passwordHash,
        isActive: props.isActive,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        name: props.name,
        email: props.email,
        normalizedEmail: props.normalizedEmail,
        passwordHash: props.passwordHash,
        isActive: props.isActive,
        updatedAt: props.updatedAt,
      },
    });
  }

  private toDomain(row: {
    id: string;
    name: string;
    email: string;
    normalizedEmail: string;
    passwordHash: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): User {
    return User.reconstitute(row);
  }
}
