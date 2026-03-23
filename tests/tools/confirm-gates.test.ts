import { describe, it, expect } from 'vitest';
import { ConfirmSchema, CoercedBooleanSchema } from '../../src/utils/validation.js';

describe('ConfirmSchema', () => {
  it('accepts true', () => {
    expect(ConfirmSchema.parse(true)).toBe(true);
  });

  it('accepts string "true"', () => {
    expect(ConfirmSchema.parse('true')).toBe(true);
  });

  it('rejects false', () => {
    expect(() => ConfirmSchema.parse(false)).toThrow('destructive');
  });

  it('rejects string "false"', () => {
    expect(() => ConfirmSchema.parse('false')).toThrow('destructive');
  });

  it('rejects undefined', () => {
    expect(() => ConfirmSchema.parse(undefined)).toThrow();
  });
});

describe('CoercedBooleanSchema', () => {
  it('coerces string "true" to true', () => {
    expect(CoercedBooleanSchema.parse('true')).toBe(true);
  });

  it('coerces string "false" to false', () => {
    expect(CoercedBooleanSchema.parse('false')).toBe(false);
  });

  it('passes through boolean true', () => {
    expect(CoercedBooleanSchema.parse(true)).toBe(true);
  });
});
