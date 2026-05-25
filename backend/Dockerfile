FROM node:20-alpine

# Build tools necesare pentru better-sqlite3 (modul nativ)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src/ ./src/

EXPOSE 3001

CMD ["node", "src/index.js"]
