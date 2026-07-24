FROM oven/bun:1.3.11 AS base

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src ./src

# The relay is built in isolation (no workspace / no lockfile), so its
# devDependencies use workspace + catalog specifiers (@repo/protocol, catalog:)
# that can't resolve here. They aren't needed at runtime, so drop them before
# installing the two real runtime deps (convex, hono).
RUN bun -e "const p = await Bun.file('package.json').json(); delete p.devDependencies; await Bun.write('package.json', JSON.stringify(p, null, 2))"

RUN bun install --production

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["bun", "run", "src/index.ts"]
