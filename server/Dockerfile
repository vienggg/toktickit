FROM node:22-alpine

# Install OpenSSL required by Prisma engine on Alpine
RUN apk add --no-cache openssl

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and code
COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/

# Build TypeScript
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --skip-generate && npx tsx prisma/seed.ts && npm start"]
