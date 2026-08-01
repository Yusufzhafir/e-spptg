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
  // `X-Robots-Tag` is the enforcing half of robots.txt: a Disallow only asks a
  // crawler not to fetch, while this tells any crawler that did fetch not to
  // index. The app shell is set here rather than in metadata because
  // src/app/app/layout.tsx is a client component and cannot export any.
  async headers() {
    return [
      {
        source: "/app/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
