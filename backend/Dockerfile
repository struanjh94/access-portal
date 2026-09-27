# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
COPY shared /app/shared
RUN npm run build

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build --chown=node:node /app/backend/dist ./dist
COPY backend/db ./db
USER node
EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]
