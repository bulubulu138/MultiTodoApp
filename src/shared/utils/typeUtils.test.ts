/**
 * typeUtils 单元测试
 *
 * 测试覆盖：
 * 1. toNumberId() 函数对 number、string、undefined 输入的处理
 * 2. 边界条件和错误场景
 */

import { toNumberId } from './typeUtils';

describe('toNumberId() - Type Conversion', () => {

  it('should handle number input correctly', () => {
    const result = toNumberId(123);
    expect(result).toBe(123);
  });

  it('should handle string number input correctly', () => {
    const result = toNumberId('456');
    expect(result).toBe(456);
  });

  it('should throw error for undefined input', () => {
    expect(() => toNumberId(undefined)).toThrow('ID cannot be undefined or null');
  });

  it('should throw error for null input', () => {
    expect(() => toNumberId(null)).toThrow('ID cannot be undefined or null');
  });

  it('should throw error for invalid string input', () => {
    expect(() => toNumberId('invalid')).toThrow('Invalid ID format: invalid');
  });

  it('should handle decimal string input', () => {
    const result = toNumberId('789.5');
    expect(result).toBe(789); // parseInt truncates decimal
  });

  it('should handle zero as valid input', () => {
    const result = toNumberId(0);
    expect(result).toBe(0);
  });

  it('should handle string "0" as valid input', () => {
    const result = toNumberId('0');
    expect(result).toBe(0);
  });

  it('should handle negative numbers', () => {
    const result = toNumberId(-100);
    expect(result).toBe(-100);
  });

  it('should handle negative string numbers', () => {
    const result = toNumberId('-200');
    expect(result).toBe(-200);
  });
});
