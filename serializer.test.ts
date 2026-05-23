import { describe, expect, it } from 'vitest';
import {
  compressionRatio,
  deserialize,
  serialize,
  simpleSerialize,
} from './serializer';

function sorted(numbers: readonly number[]): number[] {
  return [...numbers].sort((a, b) => a - b);
}

function expectRoundTrip(numbers: readonly number[]): void {
  const serialized = serialize(numbers);
  const deserialized = deserialize(serialized);

  expect(deserialized).toEqual(sorted(numbers));
}

function expectCompressionGuarantee(numbers: readonly number[]): void {
  const simple = simpleSerialize(numbers);
  const compressed = serialize(numbers);

  expect(compressed.length).toBeLessThanOrEqual(Math.floor(simple.length / 2));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;

    let result = state;

    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);

    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomNumbers(length: number, seed: number): number[] {
  const random = mulberry32(seed);

  return Array.from(
    { length },
    () => 1 + Math.floor(random() * 300),
  );
}

function repeated(value: number, count: number): number[] {
  return Array.from({ length: count }, () => value);
}

describe('serializer', () => {
  it('serializes and deserializes minimal repeated one-digit case', () => {
    const input = [1, 1, 1, 1, 1];

    expect(serialize(input)).toBe('~!');
    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('serializes and deserializes minimal distinct one-digit case', () => {
    const input = [1, 2, 3, 4, 5];

    expect(serialize(input)).toBe('~#6');
    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('serializes and deserializes mixed sample', () => {
    const input = [1, 300, 237, 188, 42];

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('does not preserve order because order is irrelevant by condition', () => {
    const first = serialize([5, 1, 5, 3, 1]);
    const second = serialize([1, 1, 3, 5, 5]);

    expect(first).toBe(second);
    expect(deserialize(first)).toEqual([1, 1, 3, 5, 5]);
  });

  it('handles random 50 numbers', () => {
    const input = randomNumbers(50, 50);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles random 100 numbers', () => {
    const input = randomNumbers(100, 100);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles random 500 numbers', () => {
    const input = randomNumbers(500, 500);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles random 1000 numbers', () => {
    const input = randomNumbers(1000, 1000);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles all one-digit values', () => {
    const input = Array.from({ length: 9 }, (_, index) => index + 1);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles all two-digit values', () => {
    const input = Array.from({ length: 90 }, (_, index) => index + 10);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles all three-digit values', () => {
    const input = Array.from({ length: 201 }, (_, index) => index + 100);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles every value from 1 to 300 repeated three times', () => {
    const input = Array.from(
      { length: 300 },
      (_, index) => repeated(index + 1, 3),
    ).flat();

    expect(input).toHaveLength(900);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles maximum length with all values equal to 1', () => {
    const input = repeated(1, 1000);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles maximum length with all values equal to 300', () => {
    const input = repeated(300, 1000);

    expectRoundTrip(input);
    expectCompressionGuarantee(input);
  });

  it('handles many deterministic stress cases', () => {
    for (let length = 5; length <= 250; length++) {
      for (let seed = 0; seed < 20; seed++) {
        const input = randomNumbers(length, length * 1000 + seed);

        expectRoundTrip(input);
        expectCompressionGuarantee(input);
      }
    }
  });

  it('rejects too short input', () => {
    expect(() => serialize([1, 2, 3, 4])).toThrow();
  });

  it('rejects too long input', () => {
    expect(() => serialize(repeated(1, 1001))).toThrow();
  });

  it('rejects values less than 1', () => {
    expect(() => serialize([1, 2, 3, 4, 0])).toThrow();
  });

  it('rejects values greater than 300', () => {
    expect(() => serialize([1, 2, 3, 4, 301])).toThrow();
  });

  it('rejects non-integer values', () => {
    expect(() => serialize([1, 2, 3, 4, 5.5])).toThrow();
  });

  it('rejects empty serialized string', () => {
    expect(() => deserialize('')).toThrow();
  });

  it('rejects unsupported serialized characters', () => {
    expect(() => deserialize(' abc')).toThrow();
  });

  it('rejects non-canonical leading zero in long mode', () => {
    expect(() => deserialize('!!')).toThrow();
  });

  it('rejects non-canonical leading zero in short mode', () => {
    expect(() => deserialize('~!!')).toThrow();
  });
});

describe('compression reports', () => {
  it('prints representative compression ratios', () => {
    const cases: Array<[string, number[]]> = [
      ['five same one-digit', [1, 1, 1, 1, 1]],
      ['five distinct one-digit', [1, 2, 3, 4, 5]],
      ['mixed sample', [1, 300, 237, 188, 42]],
      ['random 50', randomNumbers(50, 50)],
      ['random 100', randomNumbers(100, 100)],
      ['random 500', randomNumbers(500, 500)],
      ['random 1000', randomNumbers(1000, 1000)],
      ['all one-digit values', Array.from({ length: 9 }, (_, index) => index + 1)],
      ['all two-digit values', Array.from({ length: 90 }, (_, index) => index + 10)],
      ['all three-digit values', Array.from({ length: 201 }, (_, index) => index + 100)],
      [
        'each 1..300 three times',
        Array.from({ length: 300 }, (_, index) => repeated(index + 1, 3)).flat(),
      ],
    ];

    for (const [name, input] of cases) {
      const simple = simpleSerialize(input);
      const compressed = serialize(input);

      console.log({
        name,
        inputLength: input.length,
        simpleLength: simple.length,
        compressed,
        compressedLength: compressed.length,
        ratio: compressionRatio(input),
      });

      expectRoundTrip(input);
      expectCompressionGuarantee(input);
    }
  });
});