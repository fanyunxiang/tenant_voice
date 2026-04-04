const path = require('path');

/** @type {import('next').NextConfig} */

const nextConfig = {
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(__dirname, '..'),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'i.ibb.co',
      },
      {
        protocol: 'https',
        hostname: 'scontent.fotp8-1.fna.fbcdn.net',
      },
    ],
    // Make ENV
    unoptimized: true,
  },
};

// module.exports = withTM(nextConfig);
module.exports = nextConfig;
