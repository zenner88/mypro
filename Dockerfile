# ---------- deps ----------
FROM node:20-alpine AS deps
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------- builder ----------
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL hanya untuk fase build (route API sudah force-dynamic, tidak benar2 dipakai)
ENV DATABASE_URL="file:./build-placeholder.db"
RUN npx prisma generate && npm run build && rm -f prisma/build-placeholder.db

# ---------- runner ----------
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3088

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p storage/project-documents /data

EXPOSE 3088

ENTRYPOINT ["./docker-entrypoint.sh"]
