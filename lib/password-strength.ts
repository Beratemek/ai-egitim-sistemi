export type PasswordStrengthScore = 0 | 1 | 2 | 3 | 4;

export interface PasswordStrength {
  score: PasswordStrengthScore;
  label: string;
  hint: string;
}

const COMMON_PATTERNS = /(1234|qwerty|password|parola|asdf|(.)\2{3,})/i;

/**
 * Bir parola kurali degil, kullaniciya yon veren gorsel bir sezgisel olcum.
 * Uzunluk ana etkendir; karakter cesitliligi iyi bir parolayi bir kademe
 * destekler, yaygin/dizisel kaliplar ise bir kademe geri ceker.
 */
export function evaluatePasswordStrength(password: string): PasswordStrength {
  if (password.length === 0) {
    return { score: 0, label: "Henüz parola yok", hint: "En az 8 karakterle başlayın." };
  }

  let score: PasswordStrengthScore =
    password.length >= 16
      ? 4
      : password.length >= 12
        ? 3
        : password.length >= 8
          ? 2
          : 1;

  const categories = [
    /[a-zçğıöşü]/.test(password),
    /[A-ZÇĞİÖŞÜ]/.test(password),
    /\d/.test(password),
    /[^\p{L}\p{N}]/u.test(password),
  ].filter(Boolean).length;

  if (password.length >= 10 && categories >= 3 && score < 4) {
    score = (score + 1) as PasswordStrengthScore;
  }
  if (COMMON_PATTERNS.test(password) && score > 1) {
    score = (score - 1) as PasswordStrengthScore;
  }

  const messages: Record<Exclude<PasswordStrengthScore, 0>, Omit<PasswordStrength, "score">> = {
    1: { label: "Çok kısa", hint: "En az 8 karakter kullanın." },
    2: { label: "Başlangıç", hint: "12 veya daha fazla karakter daha güvenlidir." },
    3: { label: "İyi", hint: "Uzun ve size özgü bir ifade tercih edin." },
    4: { label: "Güçlü", hint: "Bu parola uzunluk bakımından güçlü görünüyor." },
  };

  return { score, ...messages[score as Exclude<PasswordStrengthScore, 0>] };
}
