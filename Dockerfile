FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* tsconfig.json vite.config.ts index.html ./
RUN npm install

COPY src ./src

ARG CATALOGUE_WORKER_URL
ENV VITE_CATALOGUE_WORKER_URL=${CATALOGUE_WORKER_URL}

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

