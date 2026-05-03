FROM oven/bun:1.3.11 AS base

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

RUN bun install --production

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
