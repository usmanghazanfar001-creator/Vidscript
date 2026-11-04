/**
 * PLACEHOLDER AUTH. Real authentication is not built yet.
 * Until then, set DEV_USER_ID in .env to the id of a User row (create one with `npx prisma studio`).
 * Every route filters by this id, so swapping in real auth later only changes this function.
 */
export class UnauthorizedError extends Error {}

export function requireUserId(): string {
  const id = process.env.DEV_USER_ID;
  if (!id) throw new UnauthorizedError("Not signed in (set DEV_USER_ID for local development)");
  return id;
}
