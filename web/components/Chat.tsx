"use client";

import { useState } from "react";

export default function Chat() {
    const [msg, setMsg] = useState("");
    const [resp, setResp] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const webhook = process.env.NEXT_PUBLIC_WEBHOOK_URL!;

    async function send() {
        setLoading(true); setResp(null);
        try {
            const r = await fetch(webhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg })
            });
            const j = await r.json();
            setResp(JSON.stringify(j, null, 2));
        } catch (e: any) {
            setResp(`Błąd: ${e?.message ?? e}`);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <h1>OLIG3D – prosty chat (echo)</h1>
            <p>Wiadomość → n8n Webhook → „Respond to Webhook” → odpowiedź JSON.</p>
            <div style={{ display: "flex", gap: 8 }}>
                <input
                    value={msg}
                    onChange={e => setMsg(e.target.value)}
                    placeholder="Napisz coś…"
                    style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
                />
                <button onClick={send} disabled={loading || !msg.trim()} style={{ padding: "8px 12px" }}>
                    {loading ? "Wysyłanie…" : "Wyślij"}
                </button>
            </div>
            {resp && (
                <pre style={{ background: "#111", color: "#0f0", padding: 12, borderRadius: 8, marginTop: 12 }}>
                    {resp}
                </pre>
            )}
        </div>
    );
}
