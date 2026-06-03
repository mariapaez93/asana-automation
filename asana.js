// src/asana.js
const axios = require("axios");

const client = axios.create({
  baseURL: "https://app.asana.com/api/1.0",
  headers: {
    Authorization: `Bearer ${process.env.ASANA_TOKEN}`,
    "Content-Type": "application/json",
  },
});

// Obtener datos de una task
async function getTask(taskGid) {
  const res = await client.get(`/tasks/${taskGid}`, {
    params: { opt_fields: "gid,name,due_on,completed,parent" },
  });
  return res.data.data;
}

// Obtener subtasks de una task
async function getSubtasks(taskGid) {
  const res = await client.get(`/tasks/${taskGid}/subtasks`, {
    params: { opt_fields: "gid,name,due_on,completed,assignee" },
  });
  return res.data.data;
}

// Actualizar el due date de una subtask
async function updateTaskDueDate(taskGid, dueOn) {
  const res = await client.put(`/tasks/${taskGid}`, {
    data: { due_on: dueOn },
  });
  return res.data.data;
}

// Registrar un webhook en Asana
async function createWebhook(resourceGid, targetUrl) {
  const res = await client.post("/webhooks", {
    data: {
      resource: resourceGid,
      target: targetUrl,
      filters: [
        {
          resource_type: "task",
          action: "changed",
          fields: ["due_on"],
        },
      ],
    },
  });
  return res.data.data;
}

// Listar webhooks existentes
async function listWebhooks(workspaceGid) {
  const res = await client.get("/webhooks", {
    params: { workspace: workspaceGid, opt_fields: "gid,resource,target,active" },
  });
  return res.data.data;
}

module.exports = { getTask, getSubtasks, updateTaskDueDate, createWebhook, listWebhooks };
