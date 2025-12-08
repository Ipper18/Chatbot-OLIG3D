FROM node:20-bullseye

# Python do geometry-service
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# 1. Zależności Node **dla backendu w /web**
COPY web/package*.json ./web/
RUN cd web && npm ci --omit=dev

# 2. Zależności Pythona dla geometry-service
COPY services/geometry/requirements.txt ./services/geometry/requirements.txt
RUN pip3 install --no-cache-dir -r services/geometry/requirements.txt

# 3. Reszta projektu
COPY . .

# 4. Skrypt startowy
RUN chmod +x scripts/docker-start.sh

EXPOSE 3000
CMD ["scripts/docker-start.sh"]
