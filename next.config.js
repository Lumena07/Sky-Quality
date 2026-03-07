/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2gb',
    },
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    }
    // Avoid bundling native canvas (used by pdfjs-dist in Node); not needed in browser.
    config.plugins.push(
      new (require('webpack').IgnorePlugin)({ resourceRegExp: /^canvas$/ })
    )
    return config
  },
}

module.exports = nextConfig
