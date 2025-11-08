FROM node:20-alpine
WORKDIR /app
# kontekst builda to /web (Base Directory), ale Dockerfile jest w /
COPY /web/package*.json ./
RUN npm ci --omit=dev
COPY /web ./
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
