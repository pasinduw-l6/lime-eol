FROM node:24-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- development (hot reload) ----
FROM base AS dev
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "start:dev"]

# ---- build ----
FROM base AS build
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

# ---- production ----
FROM node:24-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
USER node
CMD ["node", "dist/main.js"]
