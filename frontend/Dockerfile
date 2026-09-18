FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- development (hot reload) ----
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 4200
CMD ["npm", "start"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY . .
RUN npm run build

# ---- production: nginx serves the static bundle and proxies /api ----
FROM nginx:1.27-alpine AS prod
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/browser /usr/share/nginx/html
EXPOSE 80
