require("dotenv").config();
const express = require("express");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PROJECT_GID = process.env.ASANA_PROJECT_GID;

// ─── Configuración de subtasks y sus offsets ──────────────────────────────────
// Cambiá los nombres y días según tus templates
const SUBTASK_TEMPLATES = [
  { name: "Copy Due",            offsetDays: -14 },
  { name: "Client's Approval",   offsetDays: -12 },
  { name: "Klaviyo Setup",       offsetDays: -10 },
  { name: "Scheduled",           offsetDays: -7  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calculateDate(mainDueDate, offsetDays) {
  const date = new Date(mainDueDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0];
}

const asana = axios.create({
  baseURL: "https://app.asana.com/api/1.0",
  headers: { Authorization: `Bearer ${process.env.ASANA_TOKEN}`, "Content-Type": "application/json" },
});

async function sendSlack(text) {
  if (!process.env.SLACK_WEBHOOK_URL) return;
  await axios.post(process.env.SLACK_WEBHOOK_URL, { text }).catch(e => console.error("[Slack]", e.message));
}

// ─── Lógica principal ─────────────────────────────────────────────────────────
async function processDueDateChange(taskGid) {
  try {
    const { data: { data: task } } = await asana.get(`/tasks/${taskGid}`, {
      params: { opt_fields: "gid,name,due_on,parent" }
    });

    if (!task.due_on || task.parent) return;

    console.log(`[Auto] Task: "${task.name}" | Due: ${task.due_on}`);

    const { data: { data: subtasks } } = await asana.get(`/tasks/${taskGid}/subtasks`, {
      params: { opt_fields: "gid,name,due_on" }
    });

    if (!subtasks?.length) return;

    const updated = [];

    for (const subtask of subtasks) {
      const template = SUBTASK_TEMPLATES.find(t =>
        subtask.name.toLowerCase().includes(t.name.toLowerCase())
      );
      if (!template) continue;

      const newDate = calculateDate(task.due_on, template.offsetDays);
      if (subtask.due_on === newDate) continue;

      await asana.put(`/tasks/${subtask.gid}`, { data: { due_on: newDate } });
      updated.push(`• *${subtask.name}* → ${newDate}`);
      console.log(`[Auto] "${subtask.name}" → ${newDate}`);
    }

    if (updated.length > 0) {
      await sendSlack(`📅 *Due dates actualizados para "${task.name}":*\n${updated.join("\n")}`);
    }
  } catch (err) {
    console.error("[Auto] Error:", err.response?.data || err.message);
  }
}

// ─── Webhook endpoint ─────────────────────────────────────────────────────────
app.post("/webhook", (req, res) => {
  const hookSecret = req.headers["x-hook-secret"];
  if (hookSecret) {
    res.setHeader("X-Hook-Secret", hookSecret);
    return res.status(200).send();
  }

  const events = req.body.events || [];
  for (const event of events) {
    if (
      event.resource?.resource_type === "task" &&
      event.action === "changed" &&
      event.change?.field === "due_on"
    ) {
      processDueDateChange(event.resource.gid).catch(console.error);
    }
  }

  res.status(200).send("OK");
});

// ─── Setup webhook (correr una sola vez) ──────────────────────────────────────
app.get("/setup-webhook", async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) return res.status(400).json({ error: "Falta ?url=https://tu-app.railway.app" });

  try {
    const { data } = await asana.post("/webhooks", {
      data: {
        resource: PROJECT_GID,
        target: `${targetUrl}/webhook`,
        filters: [{ resource_type: "task", action: "changed", fields: ["due_on"] }],
      },
    });
    res.json({ ok: true, webhook: data.data });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ status: "ok", project: PROJECT_GID }));

app.listen(PORT, () => console.log(`✅ Corriendo en puerto ${PORT}`));
