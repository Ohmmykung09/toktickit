export const maximumMessageLength = 2_000;

export function messageValidationError(content: unknown) {
  if (typeof content !== 'string') return 'Content is required.';
  const trimmed = content.trim();
  if (!trimmed.length || trimmed.length > maximumMessageLength) {
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
