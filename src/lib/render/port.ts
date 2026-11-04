import net from "node:net";

/**
 * Asks the OS for an unused port (ephemeral range, far from 3000).
 * Remotion's default port search starts near 3000, which collides with the Next.js dev server on Windows.
 */
export function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      srv.close(() => (port > 0 ? resolve(port) : reject(new Error("Could not find a free port"))));
    });
  });
}
