FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile=false
COPY . .

FROM base AS build
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm --filter @workflow/api prisma:generate
RUN pnpm build

FROM node:24-alpine AS api-deps
WORKDIR /app
ENV CI=true
ENV NODE_ENV=production
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
RUN pnpm install --prod --filter @workflow/api... --frozen-lockfile=false \
  && pnpm --filter @workflow/api prisma:generate \
  && pnpm store prune \
  && rm -rf /root/.cache /root/.local/share/pnpm/store

FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=api-deps /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=api-deps /app/node_modules ./node_modules
COPY --from=api-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=api-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-deps /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-deps /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
EXPOSE 4000
CMD ["sh", "-c", "node apps/api/node_modules/prisma/build/index.js migrate deploy --schema apps/api/prisma/schema.prisma && node apps/api/dist/src/index.js"]

FROM nginx:1.27-alpine AS web
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
