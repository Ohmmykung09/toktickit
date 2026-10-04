import { describe, expect, it } from 'vitest';
import {
  hasUnpairedSurrogate,
  maximumMessageLength,
  messageCharacterCount,
  messageDraftError
} from '../../src/message-policy';

describe('Lab 3 message composer policy', () => {
  it('counts Unicode code points at the exact 2,000-character boundary', () => {
    const emoji = '\u{1f600}';
    expect(messageCharacterCount(emoji)).toBe(1);
    expect(messageDraftError(emoji.repeat(maximumMessageLength), 'Public Comment')).toBeNull();
    expect(messageDraftError(emoji.repeat(maximumMessageLength + 1), 'Public Comment'))
      .toBe('Public Comment must contain 1 to 2,000 characters.');
  });

  it('rejects unpaired high and low surrogates', () => {
    expect(hasUnpairedSurrogate('\ud800')).toBe(true);
    expect(hasUnpairedSurrogate('\udc00')).toBe(true);
    expect(hasUnpairedSurrogate('\u{1f600}')).toBe(false);
    expect(messageDraftError('\ud800', 'Internal Note'))
      .toBe('Internal Note contains unsupported Unicode characters.');
  });
});
