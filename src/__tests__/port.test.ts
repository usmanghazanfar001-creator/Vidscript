import { describe, expect, it } from "vitest";
import net from "node:net";
import { getFreePort } from "@/lib/render/port";

describe("getFreePort", () => {
  it("returns a usable port away from the dev server's 3000", async () => {
    const port = await getFreePort();
    expect(port).toBeGreaterThan(3100);
    await new Promise<void>((resolve, reject) => {
      const s = net.createServer();
      s.once("error", reject);
      s.listen(port, () => s.close(() => resolve()));
    });
  });
  it("gives different ports on repeated calls while one is in use", async () => {
    const a = await getFreePort();
    const hold = net.createServer();
    await new Promise<void>((r) => hold.listen(a, () => r()));
    const b = await getFreePort();
    hold.close();
    expect(b === a).toBe(false);
  });
});
