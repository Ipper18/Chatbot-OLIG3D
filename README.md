# Chatbot-OLIG3D
Tu powstanie kiedys intrukcja_____


Chatbot-OLIG3D/
├─ infra/
│  ├─ docker-compose.yml         # n8n + postgres (+ caddy opcjonalnie)
│  ├─ .env                       # sekrety (N8N_, DB_, itp.) – NIE commitować
│  └─ Caddyfile                  # reverse proxy (jeśli hostujesz tu też UI)
├─ n8n/
│  └─ workflows/                 # eksporty JSON z n8n
├─ web/                          # proste UI czatu (Next.js)
│  ├─ Dockerfile
│  └─ .env.local                 # WEBHOOK_URL do n8n (bez commitowania)
├─ data/
│  ├─ templates/
│  │  └─ zlecenia_template.csv   # szablon CSV (1000 rekordów)
│  └─ ddl/
│     └─ schema.sql              # DDL Postgresa
└─ .github/workflows/
   └─ ci-web.yml                 # build/test UI