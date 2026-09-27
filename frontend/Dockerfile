# syntax=docker/dockerfile:1

FROM node:24-alpine AS build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copied to /app/shared, not ./shared: WORKDIR is /app/frontend and the imports
# reach it as ../../shared. Same placement as the API image.
COPY shared/ /app/shared/
COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80