/** @type {import('next').NextConfig} */
const nextConfig = {
  // pdfjs-dist ships .mjs workers; keep webpack from trying to polyfill node builtins
  webpack: (config) => {
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
