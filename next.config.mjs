/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Reddit serves media from a handful of CDN hosts. Allow the common ones
    // so next/image can optimize + produce blur placeholders.
    remotePatterns: [
      { protocol: "https", hostname: "i.redd.it" },
      { protocol: "https", hostname: "preview.redd.it" },
      { protocol: "https", hostname: "external-preview.redd.it" },
      { protocol: "https", hostname: "b.thumbs.redditmedia.com" },
      { protocol: "https", hostname: "a.thumbs.redditmedia.com" },
      { protocol: "https", hostname: "styles.redditmedia.com" },
      { protocol: "https", hostname: "www.redditstatic.com" },
      { protocol: "https", hostname: "*.redditmedia.com" },
      { protocol: "https", hostname: "i.imgur.com" },
    ],
  },
};

export default nextConfig;
