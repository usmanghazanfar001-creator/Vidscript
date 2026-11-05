/* Creates the two settings that protect your Vidscript site:  npm run auth:setup
   It asks for a password (hidden as you type) and prints OWNER_PASSWORD_HASH and AUTH_SECRET for .env and Vercel.
   Nothing is stored or sent anywhere. Only a one-way hash of the password is printed. */
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline";
import { MIN_PASSWORD_LENGTH, hashPassword } from "../src/lib/authn/password";

function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s) => { if (!muted || s.includes("\n")) process.stdout.write(s); };
    process.stdout.write(question);
    muted = true;
    rl.question("", (answer) => { muted = false; rl.close(); process.stdout.write("\n"); resolve(answer); });
  });
}

async function main() {
  const password = await askHidden(`Choose a password (at least ${MIN_PASSWORD_LENGTH} characters): `);
  if (password.length < MIN_PASSWORD_LENGTH) { console.error(`Too short. Use at least ${MIN_PASSWORD_LENGTH} characters.`); process.exit(1); }
  if ((await askHidden("Type it again: ")) !== password) { console.error("The two passwords did not match."); process.exit(1); }

  console.log("\nAdd these two lines to your .env file AND to your Vercel project's Environment Variables:\n");
  console.log(`OWNER_PASSWORD_HASH=${await hashPassword(password)}`);
  console.log(`AUTH_SECRET=${randomBytes(32).toString("hex")}`);
  console.log("\nKeep your password somewhere safe. If you change AUTH_SECRET later, everyone is signed out.");
}
main().catch((e) => { console.error(e); process.exit(1); });
