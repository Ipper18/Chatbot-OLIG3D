FROM node:20-alpine

WORKDIR /app

# KONTEKST = /web ➜ kopiujemy pliki z bieżącego kontekstu
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm","start"]
