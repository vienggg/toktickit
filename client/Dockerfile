FROM node:22-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src/
COPY tests ./tests/

# Environment variable for Vite build (Browser communicates with backend on localhost)
ENV VITE_API_URL=http://localhost:3000

# Build React app
RUN npm run build

EXPOSE 5173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "5173"]
