export function getJaroDistance(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;

  const len1 = s1.length;
  const len2 = s2.length;

  let matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  if (matchWindow < 0) matchWindow = 0;

  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matchCount = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2, i + matchWindow + 1);

    for (let j = start; j < end; j++) {
      if (!matches2[j] && s1[i] === s2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matchCount++;
        break;
      }
    }
  }

  if (matchCount === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (k < len2 && !matches2[k]) {
      k++;
    }
    if (k < len2 && s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }

  const t = transpositions / 2;
  return (matchCount / len1 + matchCount / len2 + (matchCount - t) / matchCount) / 3.0;
}

export function getJaroWinklerDistance(s1: string, s2: string): number {
  const jaro = getJaroDistance(s1, s2);
  if (jaro < 0.7) return jaro;

  const p = 0.1;
  let l = 0;
  const maxL = 4;
  while (l < maxL && l < s1.length && l < s2.length && s1[l] === s2[l]) {
    l++;
  }
  return jaro + l * p * (1 - jaro);
}

export function cleanNameForComparison(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalize a phone number to a canonical digits-only form.
 * Strips spaces, dashes, parentheses, dots, and country code prefixes (+234, 234).
 * Converts leading 0 to the local 10-digit form.
 * Examples:
 *   "+234 801 234 5678" → "8012345678"
 *   "08012345678"       → "8012345678"
 *   "234-801-234-5678"  → "8012345678"
 *   "0801 234 5678"     → "8012345678"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');
  // Strip leading country code 234
  if (digits.startsWith('234') && digits.length > 10) {
    digits = digits.slice(3);
  }
  // Strip leading 0 (Nigerian local format)
  if (digits.startsWith('0') && digits.length > 9) {
    digits = digits.slice(1);
  }
  return digits;
}

/**
 * Normalize an email for comparison.
 * Lowercases and trims whitespace.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email.toLowerCase().trim();
}
