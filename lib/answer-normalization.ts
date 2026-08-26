/** "b", "B)" veya "b) seçenek" gibi girdileri kararlı şık anahtarına çevirir. */
export function normalizeOptionKey(value: string): string {
  const trimmed = value.trim();
  const leadingLetter = trimmed.match(/^[A-Za-z]/);
  return (leadingLetter ? leadingLetter[0] : trimmed).toUpperCase();
}
