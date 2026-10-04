import { describe, expect, it } from 'vitest';
import {
  maximumMessageLength,
  messageCharacterCount,
  messageValidationError,
  parseMessageBody
} from '../../src/message-policy.js';

describe('Lab 3 message policy', () => {
  it('accepts and trims content at the exact boundaries', () => {
    expect(parseMessageBody({ content: '  a  ' })).toEqual({ ok: true, content: 'a' });
    expect(parseMessageBody({ content: 'x'.repeat(maximumMessageLength) })).toEqual({
      ok: true,
      content: 'x'.repeat(maximumMessageLength)
    });
  });

  it('rejects missing, empty, oversized, non-string, and unexpected fields', () => {
    expect(messageValidationError(undefined)).toBeTruthy();
    expect(messageValidationError('   ')).toBeTruthy();
    expect(messageValidationError('x'.repeat(maximumMessageLength + 1))).toBeTruthy();
    expect(parseMessageBody({ content: 42 }).ok).toBe(false);
    expect(parseMessageBody({ content: 'valid', private: true })).toEqual({
      ok: false,
      error: 'Only content may be submitted.'
    });
  });

  it('counts Unicode code points and rejects malformed surrogate input', () => {
    const emoji = '\u{1f600}';
    expect(messageCharacterCount(emoji.repeat(maximumMessageLength))).toBe(maximumMessageLength);
    expect(parseMessageBody({ content: emoji.repeat(maximumMessageLength) }).ok).toBe(true);
    expect(parseMessageBody({ content: emoji.repeat(maximumMessageLength + 1) }).ok).toBe(false);
    expect(messageValidationError('\ud800')).toBe('Content contains unsupported Unicode characters.');
    expect(messageValidationError('\udc00')).toBe('Content contains unsupported Unicode characters.');
  });
});
