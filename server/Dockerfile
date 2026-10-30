FROM node:20-slim
WORKDIR /app

# Install dependencies needed for compiling duckdb native addons if pre-built wheels aren't found
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8080
EXPOSE 8080
CMD ["node", "index.js"]