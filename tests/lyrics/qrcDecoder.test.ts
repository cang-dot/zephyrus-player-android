import { decryptQrc, encryptQrc } from 'qrc-decoder';
import { describe, expect, it } from 'vitest';

describe('QRC decoder dependency', () => {
  it('round-trips synthetic word-timed lyrics', () => {
    const plaintext = '[0,1000](0,400)synthetic (400,600)lyrics';
    expect(decryptQrc(encryptQrc(plaintext))).toBe(plaintext);
  });

  it('rejects malformed encrypted input', () => {
    expect(() => decryptQrc('not-encrypted-hex')).toThrow();
  });
});
