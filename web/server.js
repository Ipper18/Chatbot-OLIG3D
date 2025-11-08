import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// healthcheck dla Coolify
app.get("/hc", (req, res) => res.status(200).send("OK"));

// prosty endpoint, który proxuje do n8n webhook
app.post('/api/chat', async (req, res) => {
    try {
        const url = process.env.N8N_WEBHOOK_URL; // ustawisz w Coolify
        const r = await fetch(url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(req.body || {})
        });
        const data = await r.text(); // echo z n8n
        res.status(r.status).send(data);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'n8n proxy failed' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(process.env.PORT || 3000, () => {
    console.log("up on", process.env.PORT || 3000);
});
