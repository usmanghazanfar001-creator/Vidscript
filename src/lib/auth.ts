import { headers } from "next/headers";
import { USER_HEADER, resolveUserId } from "@/lib/authn/access";

export class UnauthorizedError extends Error {}

/**
 * The signed-in user's id. The middleware verifies the session cookie and passes the id along in a header clients
 * cannot forge. In local development only, DEV_USER_ID is used when there is no session; in production it is ignored.
 * Every route and page filters its data by this id.
 */
export function requireUserId(): string {
  let headerUid: string | null = null;
  try { headerUid = headers().get(USER_HEADER); } catch { /* called outside a request */ }
  const id = resolveUserId({ headerUid, nodeEnv: process.env.NODE_ENV, devUserId: process.env.DEV_USER_ID });
  if (!id) throw new UnauthorizedError("Not signed in");
  return id;
}
