import { Email } from './email.js';
import { UserName } from './user-name.js';

export type UserProps = {
  id: string;
  name: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export class User {
  private constructor(private props: UserProps) {}

  static create(input: {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    now?: Date;
  }): User {
    const name = UserName.create(input.name);
    const email = Email.create(input.email);
    const now = input.now ?? new Date();

    return new User({
      id: input.id,
      name: name.value,
      email: email.value,
      normalizedEmail: email.normalized,
      passwordHash: input.passwordHash,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: UserProps): User {
    return new User(props);
  }

  get id(): string {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get email(): string {
    return this.props.email;
  }

  get normalizedEmail(): string {
    return this.props.normalizedEmail;
  }

  get passwordHash(): string {
    return this.props.passwordHash;
  }

  get isActive(): boolean {
    return this.props.isActive;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  toPublic() {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
    };
  }

  toProps(): UserProps {
    return { ...this.props };
  }
}
