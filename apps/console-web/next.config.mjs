/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Les packages du workspace sont en TS non transpilé → Next doit les transpiler.
  transpilePackages: [
    '@transpo/ui-web',
    '@transpo/domain',
    '@transpo/i18n',
    '@transpo/design-tokens',
    '@transpo/api-client',
  ],
};
export default nextConfig;
