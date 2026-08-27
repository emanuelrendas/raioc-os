/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=*, camera=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob: data:; media-src 'self' blob: data: https://api.elevenlabs.io;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
