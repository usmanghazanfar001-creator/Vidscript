/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remotion bundler/renderer must stay server-side only, never bundled for the browser.
  experimental: { serverComponentsExternalPackages: ["@remotion/bundler", "@remotion/renderer"] },
};
export default nextConfig;
