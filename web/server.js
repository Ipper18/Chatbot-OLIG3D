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



function basicAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const [type, encoded] = header.split(' ');
    if (type !== 'Basic' || !encoded) {
        res.setHeader('WWW-Authenticate', 'Basic realm="OLIG3D Admin"');
        return res.status(401).end('Auth required');
    }

    const [user, pass] = Buffer.from(encoded, 'base64').toString().split(':');
    if (user !== process.env.ADMIN_USER || pass !== process.env.ADMIN_PASS) {
        return res.status(403).end('Forbidden');
    }

    next();
}

app.use('/api/admin', basicAuth);


app.use(express.json());

// zdrowie dla Coolify
app.get('/hc', (_req, res) => res.status(200).send('OK'));

// statyki (serwuj /web/public)
app.use(express.static(path.join(__dirname, 'public')));

// root → index.html (żeby nie było "Cannot GET /")
app.get('/', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/api/admin/pricing', async (req, res) => {
    try {
        const r = await axios.post(
            process.env.N8N_PRICING_GET_URL,
            {},
            { timeout: 10000 },
        );
        res.json(r.data);
    } catch (e) {
        console.error(e.message);
        res.status(500).json({ success: false, error: 'pricing_get_failed' });
    }
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
        const r = await axios.post(
            process.env.N8N_QUOTE_WEBHOOK_URL,
            { extId: req.params.extId },
            {
                timeout: 15000,
                // ważne: nie rzucaj wyjątku dla 4xx, chcemy sami obsłużyć
                validateStatus: () => true,
            },
        );

        const data = r.data || {};
        const status = data.httpStatus || r.status || 200;

        res.status(status).json(data);
    } catch (e) {
        console.error('QUOTE ERROR', e.message);
        const status = e.response?.status || 500;

        res.status(status).json({
            success: false,
            error: 'QUOTE_PROXY_ERROR',
            detail: e.response?.data || e.message,
        });
    }
});

app.get('/api/quote/:extId/history', async (req, res) => {
    const { extId } = req.params;

    try {
        const r = await axios.post(
            process.env.N8N_QUOTE_HISTORY_WEBHOOK_URL,
            { extId },
            { timeout: 15000 },
        );

        res.json(r.data);
    } catch (e) {
        console.error('quote history error', e.message);
        const status = e.response?.status || 500;
        res.status(status).json({
            success: false,
            error: 'quote_history_failed',
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

app.post('/api/quote/:id/accept', async (req, res) => {
    const { id } = req.params;
    const { acceptedBy } = req.body || {};

    try {
        const r = await axios.post(
            process.env.N8N_QUOTE_ACCEPT_WEBHOOK_URL,
            { quoteId: id, acceptedBy: acceptedBy || null },
            { timeout: 15000 },
        );

        res.json(r.data);
    } catch (e) {
        console.error('quote accept error', e.message);
        const status = e.response?.status || 500;
        res.status(status).json({
            success: false,
            error: 'quote_accept_failed',
            detail: e.response?.data || e.message,
        });
    }
});

app.post('/api/admin/pricing', async (req, res) => {
    try {
        const r = await axios.post(
            process.env.N8N_PRICING_SAVE_URL,
            req.body,
            { timeout: 10000 },
        );
        res.json(r.data);
    } catch (e) {
        console.error(e.message);
        res.status(500).json({ success: false, error: 'pricing_save_failed' });
    }
});