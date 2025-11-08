import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // np. https://n8n.olig.site/webhook/chat/echo

if (!N8N_WEBHOOK_URL) {
    console.error("Brak N8N_WEBHOOK_URL");
    process.exit(1);
}

app.use(express.json());

app.get("/hc", (_req, res) => res.status(200).send("OK"));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
    try {
        const { message } = req.body ?? {};
        if (!message) return res.status(400).json({ ok: false, error: "message required" });

        const r = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ message })
        });
        const data = await r.json().catch(() => ({}));
        res.status(r.ok ? 200 : 502).json(data);
    } catch (e) {
        res.status(500).json({ ok: false, error: String(e) });
    }
});

app.listen(PORT, () => console.log(`OLIG3D web na porcie ${PORT}`));
