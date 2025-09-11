/**** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: []
  },
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  experimental: {
    forceSwcTransforms: true
  },
  webpack: (config, { isServer }) => {
    // Exclude mobile app directory from build
    config.watchOptions = {
      ignored: [
        '**/mobile-app.bak/**',
        '**/components/**/*.bak'
      ]
    }
    return config
  }
};

module.exports = nextConfig;
