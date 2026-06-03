// src/index.js
require("dotenv").config();
const express = require("express");
const crypto = require("crypto");
const { processDueDateChange } = require("./automation");
const { createWebhook } = require("./asana");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROJECT_GID = process.env.ASANA_PROJECT_GID;

// ─── Webhook de Asana ─────────────────────────────────────────────────────────
// Asana hace un handshake la primera vez que registrás el webhook:
// manda un header X-Hook-Secret y vos tenés que devolverlo en la respuesta.
// Después de eso, manda eventos reales.

app.post("/webhook", (req, res) => {
  // Paso 1: Handshake inicial
  const hookSecret = req.headers["x-hook-secret"];
  if (hookSecret) {
    console.log("[Webhook] Handshake de Asana recibido. Respondiendo...");
    res.setHeader("X-Hook-Secret", hookSecret);
    return res.status(200).send();
  }

  // Paso 2: Verificar firma HMAC (seguridad)
  const signature = req.headers["x-hook-signature"];
  if (signature && process.env.WEBHOOK_SECRET) {
    const expectedSig = crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (signature !== expectedSig) {
      console.warn("[Webhook] Firma inválida, ignorando evento.");
      return res.status(403).send("Forbidden");
    }
  }

  // Paso 3: Procesar eventos
  const events = req.body.events || [];
  console.log(`[Webhook] ${events.length} evento(s) recibido(s).`);

  for (const event of events) {
    const isDueDateChange =
      event.resource?.resource_type === "task" &&
      event.action === "changed" &&
      event.change?.field === "due_on";

    if (isDueDateChange) {
      const taskGid = event.resource.gid;
      console.log(`[Webhook] Due date cambiado en task: ${taskGid}`);
      // Procesar de forma asíncrona para no bloquear la respuesta
      processDueDateChange(taskGid).catch(console.error);
    }
  }

  res.status(200).send("OK");
});

// ─── Endpoint de salud ────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "ok", project: PROJECT_GID });
});

// ─── Endpoint para registrar el webhook manualmente ───────────────────────────
// Llamalo UNA sola vez después de deployar: GET /setup-webhook?url=https://tu-app.railway.app
app.get("/setup-webhook", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).json({ error: "Falta el parámetro ?url=https://tu-app.railway.app/webhook" });
  }

  try {
    const webhook = await createWebhook(PROJECT_GID, `${targetUrl}/webhook`);
    console.log(`[Setup] Webhook registrado:`, webhook);
    res.json({ ok: true, webhook });
  } catch (err) {
    console.error("[Setup] Error:", err.response?.data || err.message);
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Asana Automation corriendo en puerto ${PORT}`);
  console.log(`   Proyecto: ${PROJECT_GID}`);
  console.log(`   Webhook endpoint: POST /webhook`);
  console.log(`   Registrar webhook: GET /setup-webhook?url=https://tu-url`);
});
