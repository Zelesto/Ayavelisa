FROM node:22-alpine
WORKDIR /app

RUN corepack enable
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

ENV NODE_ENV=production
EXPOSE 3000
CMD ["sh", "-c", "pnpm run db:push && pnpm start"]
