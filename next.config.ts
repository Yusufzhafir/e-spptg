import type { NextConfig } from "next";

// Host bucket untuk next/image. Di deployment on-prem (MinIO path-style) env ini
// bisa kosong; jangan kirim hostname "." ke Next karena config-nya invalid.
const s3ImageHost =
  process.env.S3_BUCKET_NAME && process.env.S3_DOMAIN
    ? `${process.env.S3_BUCKET_NAME}.${process.env.S3_DOMAIN}`
    : undefined;

// Lockfile di folder induk membuat Next menebak root di luar project, sehingga
// output standalone jadi bersarang (.next/standalone/<path>/server.js) dan
// COPY di Dockerfile gagal. Pin root ke folder project ini.
const projectRoot = process.cwd();

const nextConfig: NextConfig = {
  // Dibutuhkan image Docker: build menghasilkan .next/standalone/server.js
  // sehingga runtime tidak perlu node_modules penuh.
  output: "standalone",
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  images: {
    remotePatterns: s3ImageHost
      ? [
          {
            protocol: "https",
            hostname: s3ImageHost,
          },
        ]
      : [],
  },
};

export default nextConfig;
