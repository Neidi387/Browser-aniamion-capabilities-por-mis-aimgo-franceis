FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
ENV PORT=3001
EXPOSE 3001
CMD ["node", "build/index.js"]
