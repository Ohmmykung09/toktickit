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

export function messageDraftError(value: string, label: string) {
  const trimmed = value.trim();
  if (hasUnpairedSurrogate(trimmed)) return `${label} contains unsupported Unicode characters.`;
  if (!trimmed.length || messageCharacterCount(trimmed) > maximumMessageLength) {
    return `${label} must contain 1 to ${maximumMessageLength.toLocaleString('en-US')} characters.`;
  }
  return null;
}
