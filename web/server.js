const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const N8N_URL = process.env.N8N_WEBHOOK_URL;
const N8N_CHAT_URL = process.env.N8N_CHAT_WEBHOOK_URL;
const N8N_QUOTE_URL = process.env.N8N_QUOTE_WEBHOOK_URL;
const client = require('prom-client');
client.collectDefaultMetrics(); // zbiera CPU, RAM, GC itd.   


app.use(express.json());

// zdrowie dla Coolify
app.get('/hc', (_req, res) => res.status(200).send('OK'));

// statyki (serwuj /web/public)
app.use(express.static(path.join(__dirname, 'public')));

// root → index.html (żeby nie było "Cannot GET /")
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// proxy do n8n
app.post('/api/chat', async (req, res) => {
    try {
        const r = await axios.post(process.env.N8N_CHAT_WEBHOOK_URL, {
            message: req.body.message,
            sessionId: req.body.sessionId || null,
        }, { timeout: 10000 });

        res.json(r.data); // { reply: "...", ... }
    } catch (e) {
        console.error(e.message);
        res.status(500).json({ success: false, error: 'chat_failed' });
    }
});

app.get('/api/quote/:extId', async (req, res) => {
    try {
        const r = await axios.post(process.env.N8N_QUOTE_WEBHOOK_URL, {
            extId: req.params.extId,
        }, { timeout: 15000 });

        res.json(r.data); // { quoteId, total, breakdown... }
    } catch (e) {
        const status = e.response?.status || 500;
        res.status(status).json({
            error: 'quote_failed',
            detail: e.response?.data || e.message,
        });
    }
});

app.get('/metrics', async (_req, res) => {
    try {
        res.set('Content-Type', client.register.contentType);
        res.end(await client.register.metrics());
    } catch (err) {
        res.status(500).end(err.message);
    }
});

app.get('/quote', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'quote.html'));
});


app.listen(PORT, () => {
    console.log(`OLIG3D listening on :${PORT}`);
});
