/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'ngipen-makicos-seven.vercel.app',
          },
        ],
        destination: 'https://ngipen.my.id/:path*',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
