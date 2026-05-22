# syntax=docker/dockerfile:1
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
# No lockfile is committed; install prod deps only.
RUN npm install --omit=dev --no-audit --no-fund

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Run as the unprivileged "node" user that ships with the base image.
COPY --chown=node:node --from=deps /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public

USER node
EXPOSE 3000
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
