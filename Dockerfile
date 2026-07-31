# syntax=docker/dockerfile:1.7
#
# E-SPPTG — image aplikasi Next.js (standalone).
# PostgreSQL + PostGIS dan MinIO TIDAK ada di dalam image ini: keduanya jalan
# langsung di server (host). Container hanya berisi proses Node.js.
#
# Debian slim dipakai (bukan alpine) supaya prebuilt binary sharp / @react-pdf
# tidak perlu dikompilasi ulang di musl.

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------------------------------------------------------------------------
# deps — install node_modules (termasuk devDependencies, dibutuhkan next build
#        dan drizzle-kit)
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS deps
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# builder — pnpm build (sekaligus type check)
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS builder
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=1 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate
WORKDIR /app

# NEXT_PUBLIC_* di-inline saat build, jadi WAJIB dikirim sebagai build arg.
# Kalau salah/kosong, Google Maps mati di browser walaupun .env runtime benar.
ARG NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
# Dipakai next.config.ts untuk images.remotePatterns (opsional).
ARG S3_BUCKET_NAME
ARG S3_DOMAIN
ENV NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=$NEXT_PUBLIC_GOOGLE_MAPS_API_KEY \
    S3_BUCKET_NAME=$S3_BUCKET_NAME \
    S3_DOMAIN=$S3_DOMAIN

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN NODE_ENV=production pnpm build

# ---------------------------------------------------------------------------
# migrator — image untuk menjalankan migrasi Drizzle (dipakai service `migrate`)
# ---------------------------------------------------------------------------
FROM builder AS migrator
# prod.drizzle.config.ts memanggil dotenv untuk .env.development.prod; file itu
# tidak ada di image, jadi DATABASE_URL_DDL diambil dari environment container.
CMD ["pnpm", "drizzle-kit", "migrate", "--config", "prod.drizzle.config.ts"]

# ---------------------------------------------------------------------------
# runner — image produksi, hanya output standalone
# ---------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Makassar
WORKDIR /app

RUN groupadd --system --gid 1001 nodejs \
    && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# server.js adalah entrypoint output standalone Next.js
CMD ["node", "server.js"]
