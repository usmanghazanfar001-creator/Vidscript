import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/** Node only. Stored format: scrypt:N:r:p:saltHex:hashHex (colons, not "$", because .env loaders expand "$"). */
const scrypt = (pw: string, salt: Buffer, keylen: number, N: number, r: number, p: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, keylen, { N, r, p, maxmem: 128 * N * r * 2 }, (e, k) => (e ? reject(e) : resolve(k))));

export const MIN_PASSWORD_LENGTH = 12;
const MAX_N = 2 ** 17; // refuse absurd cost parameters from a tampered setting

export async function hashPassword(password: string): Promise<string> {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, 32, N, r, p);
  return `scrypt:${N}:${r}:${p}:${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | undefined): Promise<boolean> {
  const parts = (stored ?? "").split(":");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  if (![N, r, p].every(Number.isInteger) || N < 2 || N > MAX_N || (N & (N - 1)) !== 0 || r < 1 || r > 16 || p < 1 || p > 4) return false;
  if (!/^[0-9a-f]+$/i.test(parts[4]!) || !/^[0-9a-f]+$/i.test(parts[5]!)) return false;
  const expected = Buffer.from(parts[5]!, "hex");
  if (expected.length < 16) return false;
  const actual = await scrypt(password, Buffer.from(parts[4]!, "hex"), expected.length, N, r, p);
  return timingSafeEqual(actual, expected);
}
