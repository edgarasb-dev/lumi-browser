import crypto from "crypto";
import type { PasswordGeneratorOptions } from "~/types/passwords";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+";

export function generateStrongPassword(options: PasswordGeneratorOptions = {}): string {
  const length = Math.max(8, Math.min(64, Math.floor(options.length ?? 18)));
  const pools: string[] = [];
  if (options.uppercase !== false) pools.push(UPPER);
  if (options.lowercase !== false) pools.push(LOWER);
  if (options.digits !== false) pools.push(DIGITS);
  if (options.symbols !== false) pools.push(SYMBOLS);

  if (pools.length === 0) {
    pools.push(UPPER, LOWER, DIGITS);
  }

  const combined = pools.join("");
  const chars: string[] = [];

  // Guarantee at least one character from each active class
  for (const pool of pools) {
    if (chars.length < length) {
      chars.push(pool[crypto.randomInt(pool.length)]!);
    }
  }

  while (chars.length < length) {
    chars.push(combined[crypto.randomInt(combined.length)]!);
  }

  // Fisher-Yates shuffle with CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    const tmp = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = tmp;
  }

  return chars.join("");
}
