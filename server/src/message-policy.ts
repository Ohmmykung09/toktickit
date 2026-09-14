export const maximumMessageLength = 2_000;

export function hasUnpairedSurrogate(value: string) {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) return true;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return true;
    }
  }
  return false;
}

export function messageCharacterCount(value: string) {
  return Array.from(value).length;
}

export function messageValidationError(content: unknown) {
  if (typeof content !== 'string') return 'Content is required.';
  const trimmed = content.trim();
  if (hasUnpairedSurrogate(trimmed)) return 'Content contains unsupported Unicode characters.';
  if (!trimmed.length || messageCharacterCount(trimmed) > maximumMessageLength) {
    return `Content must contain 1 to ${maximumMessageLength.toLocaleString('en-US')} characters.`;
  }
  return null;
}

export function parseMessageBody(body: unknown) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Content is required.' } as const;
  }
  const input = body as Record<string, unknown>;
  if (Object.keys(input).some((key) => key !== 'content')) {
    return { ok: false, error: 'Only content may be submitted.' } as const;
  }
  const error = messageValidationError(input.content);
  if (error) return { ok: false, error } as const;
  return { ok: true, content: (input.content as string).trim() } as const;
}
