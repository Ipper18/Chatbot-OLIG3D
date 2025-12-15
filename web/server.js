const multer = require('multer');
const FormData = require('form-data');
const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const N8N_URL = process.env.N8N_WEBHOOK_URL;
const N8N_CHAT_URL = process.env.N8N_CHAT_WEBHOOK_URL;
const N8N_QUOTE_URL = process.env.N8N_QUOTE_WEBHOOK_URL;
const client = require('prom-client');
client.collectDefaultMetrics(); // zbiera CPU, RAM, GC itd.   
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
});
const GEOMETRY_URL = process.env.GEOMETRY_URL || 'http://localhost:8000';


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

async function analyzeGeometryWithFastAPI(file) {
    if (!file) {
        const error = new Error('No model file uploaded');
        error.statusCode = 400;
        throw error;
    }

    const base = (process.env.GEOMETRY_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const url = `${base}/analyze`;

    const form = new FormData();
    form.append('file', file.buffer, {
        filename: file.originalname || 'model.stl',
        contentType: file.mimetype || 'application/octet-stream',
    });

    console.log(`[NodeJS] Wysyłanie pliku do analizy: ${url}`);

    try {
        const response = await axios.post(url, form, {
            headers: form.getHeaders(),
            timeout: 30000,
        });

        const raw = response.data || {};

        // --- DEBUG: Zobaczmy co zwraca Python ---
        console.log("[NodeJS] Odpowiedź z Pythona:", JSON.stringify(raw, null, 2));

        // Sprawdzenie czy Python nie zwrócił błędu
        if (raw.error) {
            console.error("[NodeJS] Python zwrócił błąd logiczny:", raw.error);
            // Możemy tu rzucić błąd, żeby n8n nie dostało pustych danych
            throw new Error(`Geometry service error: ${raw.error}`);
        }
        // ----------------------------------------

        // FIX: Obsługa różnych nazw kluczy z Pythona
        // Python w nowym kodzie zwraca "bounding_box" (lista list)
        const bbox = raw.bounding_box || raw.bbox || raw.bbox_mm || [];

        // Wyciągnięcie wysokości
        // bbox w formacie [[minX, minY, minZ], [maxX, maxY, maxZ]]
        let heightFromBox = 0;
        if (Array.isArray(bbox) && bbox.length === 2 && bbox[1].length === 3) {
            heightFromBox = bbox[1][2] - bbox[0][2];
        }

        return {
            ...raw,
            volume_cm3: raw.volume_cm3 ?? (raw.volume_mm3 ? raw.volume_mm3 / 1000 : 0),
            bounding_box: bbox,
            dimensions_mm: raw.dimensions_mm || null,
            height_mm: raw.height_mm ?? heightFromBox ?? 0,
        };

    } catch (err) {
        console.error("[NodeJS] Błąd połączenia z Pythonem:", err.message);
        if (err.response) {
            console.error("[NodeJS] Dane błędu:", err.response.data);
        }
        // Rzucamy dalej, żeby endpoint zwrócił błąd 500 zamiast pustego JSONa
        throw err;
    }
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

        // r.data = tablica z n8n
        const settingsArray = Array.isArray(r.data)
            ? r.data
            : (Array.isArray(r.data.settings) ? r.data.settings : []);

        res.json({
            success: true,
            settings: settingsArray,
        });
    } catch (e) {
        console.error(e.message);
        res.status(500).json({
            success: false,
            error: 'pricing_get_failed',
        });
    }
});


// proxy do n8n
app.post('/api/chat', async (req, res) => {
    const url = process.env.N8N_CHAT_WEBHOOK_URL;

    if (!url) {
        return res.status(500).json({ success: false, error: 'chat_url_missing' });
    }

    const message = (req.body?.message || '').toString();
    const sessionId = req.body?.sessionId || null;

    try {
        const r = await axios.post(
            url,
            { message, sessionId },
            { timeout: 30000 } // 30s
        );

        const data = r.data;
        const payload = Array.isArray(data) ? data[0] : data;

        const reply = payload?.reply ?? null;
        const sid = payload?.sessionId ?? sessionId;

        if (!reply) {
            return res.status(502).json({
                success: false,
                error: 'chat_bad_response',
                raw: data,
            });
        }

        return res.json({ success: true, sessionId: sid, reply });
    } catch (e) {
        console.error('[CHAT]', e?.message);
        return res.status(500).json({ success: false, error: 'chat_failed' });
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

app.get('/chat', (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

app.get('/admin-pricing', basicAuth, (_req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-pricing.html'));
});

app.listen(PORT, HOST, () => {
    console.log(`OLIG3D backend listening on http://${HOST}:${PORT}`);
});

app.post('/api/quote/:id/accept', async (req, res) => {
    const { id } = req.params;
    const { acceptedBy } = req.body || {};

    // 1) Walidacja ID jeszcze przed n8n
    if (!id || id === 'undefined') {
        return res.status(400).json({
            success: false,
            error: 'invalid_quote_id',
            message: 'Brak poprawnego ID wyceny (stara/testowa wycena bez rekordu w bazie).',
        });
    }

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

        // jeśli n8n zwróci 2xx – traktujemy jako sukces
        if (r.status >= 200 && r.status < 300) {
            res.json({ success: true });
        } else {
            res.status(500).json({
                success: false,
                error: 'pricing_save_failed',
                detail: r.data,
            });
        }
    } catch (e) {
        console.error(e.message);
        res.status(500).json({
            success: false,
            error: 'pricing_save_failed',
        });
    }
});

// Analiza STL/OBJ – proxy do geometry-service
app.post('/api/model/analyze', upload.single('model'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const geometry = await analyzeGeometryWithFastAPI(req.file);

        return res.json({
            success: true,
            filename: req.file.originalname,
            size: req.file.size,
            geometry,
        });
    } catch (err) {
        console.error('Geometry analyze error:', err.response?.data || err.message);
        const status = err.statusCode || err.response?.status || 500;
        return res.status(status).json({
            error: 'Geometry analysis failed',
            details: err.response?.data || err.message,
        });
    }
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});


app.post('/api/quote-from-stl', upload.single('model'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // 1. Analiza geometrii
        const geometry = await analyzeGeometryWithFastAPI(req.file);

        // 2. Wywołanie n8n
        const n8nUrl =
            process.env.N8N_QUOTE_FROM_STL_WEBHOOK_URL ||
            process.env.N8N_QUOTE_WEBHOOK_URL;

        if (!n8nUrl) {
            return res.status(500).json({ error: 'n8n quote webhook URL not configured' });
        }

        // FIX: Przekazujemy dimensions_mm do payloadu n8n
        const payload = {
            geometry: {
                volume_cm3: geometry.volume_cm3,
                height_mm: geometry.height_mm,
                bounding_box: geometry.bounding_box,
                dimensions_mm: geometry.dimensions_mm // <--- KLUCZOWE: przekazanie wymiarów
            },
            filename: req.file.originalname, // Przekazujemy też nazwę pliku
            material: req.body.material || 'PLA',
            source: 'stl',
        };

        const { data: quote } = await axios.post(n8nUrl, payload, { timeout: 30000 });

        return res.json({
            success: true,
            geometry,
            quote,
        });
    } catch (err) {
        console.error('Quote from STL error:', err.response?.data || err.message);
        const status = err.response?.status || 500;
        return res.status(status).json({
            error: 'Quote from STL failed',
            details: err.response?.data || err.message,
        });
    }
});

app.get('/api/chat/history', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-store');

        const sessionId = String(req.query.sessionId || '').trim();
        const source = String(req.query.source || 'web-3d.olig.site').trim();

        if (!sessionId) {
            return res.status(400).json({ success: false, error: 'Missing sessionId' });
        }

        const url = process.env.N8N_CHAT_HISTORY_WEBHOOK_URL;
        if (!url) {
            return res.status(500).json({ success: false, error: 'Missing N8N_CHAT_HISTORY_WEBHOOK_URL' });
        }

        const r = await axios.get(url, {
            params: { sessionId, source },
            timeout: 20000,
        });

        return res.json(r.data);
    } catch (err) {
        return res.status(500).json({
            success: false,
            error: 'Chat history proxy error',
            details: err?.message || String(err),
        });
    }
});