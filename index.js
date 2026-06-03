require("dotenv").config();
const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

const SUBTASK_OFFSETS = {
  "copy due":           -14,
  "client's approval":  -12,
  "klaviyo setup":      -10,
  "scheduled":          -7,
};

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function asanaRequest(method, path, data) {
  const token = process.env.ASANA_TOKEN || "";
  return axios({
    method,
    url: "https://app.asana.com/api/1.0" + path,
    headers: {
      "Authorization": "Bearer " + token.trim(),
      "Content-Type": "application/json"
    },
    data
  });
}

async function processDueDateChange(taskGid) {
  const { data: { data: task } } = await asanaRequest("get", "/tasks/" + taskGid + "?opt_fields=gid,name,due_on,parent");
  if (!task.due_on || task.parent) return;

  console.log("Task: " + task.name + " | Due: " + task.due_on);

  const { data: { data: subtasks } } = await asanaRequest("get", "/tasks/" + taskGid + "/subtasks?opt_fields=gid,name,due_on");
  if (!subtasks || !subtasks.length) return;

  for (const sub of subtasks) {
    const key = Object.keys(SUBTASK_OFFSETS).find(k => sub.name.toLowerCase().includes(k));
    if (!key) continue;
    const newDate = addDays(task.due_on, SUBTASK_OFFSETS[key]);
    if (sub.due_on === newDate) continue;
    await asanaRequest("put", "/tasks/" + sub.gid, { data: { due_on: newDate } });
    console.log("Updated " + sub.name + " -> " + newDate);
  }
}

app.post("/webhook", (req, res) => {
  const secret = req.headers["x-hook-secret"];
  if (secret) { res.setHeader("X-Hook-Secret", secret); return res.sendStatus(200); }
  const events = req.body.events || [];
  for (const e of events) {
    if (e.resource?.resource_type === "task" && e.action === "changed" && e.change?.field === "due_on") {
      processDueDateChange(e.resource.gid).catch(err => console.error(err.message));
    }
  }
  res.sendStatus(200);
});

app.get("/setup-webhook", async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ error: "Falta ?url=https://tu-app" });
  try {
    const { data } = await asanaRequest("post", "/webhooks", {
      data: {
        resource: process.env.ASANA_PROJECT_GID,
        target: url + "/webhook",
        filters: [{ resource_type: "task", action: "changed", fields: ["due_on"] }]
      }
    });
    res.json({ ok: true, webhook: data.data });
  } catch (e) {
    res.status(500).json({ error: e.response?.data || e.message });
  }
});

app.get("/health", async (req, res) => {
  try {
    const { data } = await asanaRequest("get", "/users/me?opt_fields=name");
    res.json({ status: "ok", asana_user: data.data.name, project: process.env.ASANA_PROJECT_GID });
  } catch (e) {
    res.json({ status: "error", message: e.response?.data || e.message, token_present: !!process.env.ASANA_TOKEN });
  }
});

app.listen(PORT, () => console.log("Running on port " + PORT));
