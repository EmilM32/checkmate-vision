/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@workspace/ui"],
  async headers() {
    return [
      {
        // Engine files are named after the exact Stockfish package version
        // (see scripts/copy-stockfish.mjs), so their content never changes.
        source: "/stockfish/:file*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ]
  },
}

export default nextConfig
