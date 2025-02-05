/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Fixes npm packages that depend on `fs` module
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        os: false,
        path: false,
        stream: false,
        zlib: false,
      }
    }

    config.module.rules.push({
      test: /\.node$/,
      use: 'node-loader',
      type: 'javascript/auto',
    })

    // Add a rule to handle discord.js and its dependencies
    config.module.rules.push({
      test: /\.js$/,
      include: [
        /node_modules\/(discord\.js|@discordjs|undici)/
      ],
      type: 'javascript/auto',
    })

    return config
  },
  // Needed for discord.js
  experimental: {
    serverComponentsExternalPackages: ['discord.js']
  }
}

module.exports = nextConfig 