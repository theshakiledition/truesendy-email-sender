# Production Dockerfile for Node.js Backend
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev || true
RUN npx prisma generate || true

# Copy source code
COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
