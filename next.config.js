/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the widget.js and widget.css static files to be served
  // with permissive CORS headers so any site can embed them
  async headers() {
    return [
      {
        source: '/widget.js',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/widget.css',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        // Allow /search to be embedded as an iframe on any site
        // Only use CSP frame-ancestors (X-Frame-Options ALLOWALL is not valid and Chrome treats it as DENY)
        source: '/search',
        headers: [
          { key: 'Content-Security-Policy', value: "frame-ancestors *" },
        ],
      },
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
