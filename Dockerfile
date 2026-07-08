FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/api-server/package.json packages/api-server/package.json
COPY packages/sdk-typescript/package.json packages/sdk-typescript/package.json
COPY packages/admin-dashboard/package.json packages/admin-dashboard/package.json
COPY packages/demo-store/package.json packages/demo-store/package.json

RUN npm ci

COPY . .
ENV VITE_BASE_PATH=/dashboard/
RUN npm run build --workspace=packages/admin-dashboard
ENV VITE_BASE_PATH=/store/
RUN npm run build --workspace=packages/demo-store
RUN npm run build --workspace=packages/api-server

FROM node:20-alpine AS api

ENV NODE_ENV=development
ENV PORT=3001
ENV FIBER_MERCHANT_DB_PATH=/data/merchant.db

WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/api-server/package.json ./packages/api-server/package.json
COPY --from=build /app/packages/api-server/dist ./packages/api-server/dist
COPY --from=build /app/packages/admin-dashboard/dist ./packages/admin-dashboard/dist
COPY --from=build /app/packages/demo-store/dist ./packages/demo-store/dist

RUN mkdir -p /data

EXPOSE 3001

CMD ["node", "packages/api-server/dist/index.js"]
