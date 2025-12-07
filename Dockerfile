FROM node:20-bullseye

# Python do geometry-service
RUN apt-get update && apt-get install -y \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Node deps
COPY package*.json ./
RUN npm ci --omit=dev

# Python deps
COPY services/geometry/requirements.txt ./services/geometry/requirements.txt
RUN pip3 install --no-cache-dir -r services/geometry/requirements.txt

# Reszta projektu
COPY . .

# start script
RUN chmod +x scripts/docker-start.sh

EXPOSE 3000
# (8000 nie musi być wystawiony na zewnątrz, geometry używamy z Node)
CMD ["scripts/docker-start.sh"]
