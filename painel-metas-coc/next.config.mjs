/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",       // site estático: roda na Netlify e em qualquer plano da Hostinger
  trailingSlash: true,
  images: { unoptimized: true },
};
export default nextConfig;
