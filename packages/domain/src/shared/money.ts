/**
 * Representa valores monetários em centavos (bigint).
 * Ex.: R$ 191,27 = 19127n
 */
export class Money {
  private constructor(readonly cents: bigint) {}

  static fromCents(cents: bigint | number | string): Money {
    const value = typeof cents === 'bigint' ? cents : BigInt(cents);

    if (!Number.isInteger(Number(value)) && typeof cents === 'number') {
      throw new Error('Money.fromCents exige valor inteiro em centavos');
    }

    return new Money(value);
  }

  static zero(): Money {
    return new Money(0n);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  isNegative(): boolean {
    return this.cents < 0n;
  }

  equals(other: Money): boolean {
    return this.cents === other.cents;
  }

  toNumber(): number {
    return Number(this.cents);
  }

  toString(): string {
    return this.cents.toString();
  }
}
