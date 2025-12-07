import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: (process.env.S3_BUCKET_NAME || "") + "." + (process.env.S3_DOMAIN || ""),
      },
    ],
  },
};

export default nextConfig;
