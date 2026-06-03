// src/slack.js
const axios = require("axios");

async function sendSlackMessage(blocks, fallbackText = "") {
  if (!process.env.SLACK_WEBHOOK_URL) {
    console.log("[Slack] No webhook configurado, salteando notificación.");
    return;
  }

  try {
    await axios.post(process.env.SLACK_WEBHOOK_URL, {
      text: fallbackText,
      blocks,
    });
    console.log("[Slack] Mensaje enviado.");
  } catch (err) {
    console.error("[Slack] Error al enviar mensaje:", err.message);
  }
}

// Notificación cuando se actualizan las fechas de subtasks
async function notifyDatesUpdated(taskName, subtasks) {
  const subtaskLines = subtasks
    .map((s) => `• *${s.name}* → ${s.newDate}`)
    .join("\n");

  await sendSlackMessage(
    [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "📅 Due dates actualizados",
          emoji: true,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `Las subtasks de *${taskName}* fueron actualizadas automáticamente:\n\n${subtaskLines}`,
        },
      },
    ],
    `Due dates actualizados para ${taskName}`
  );
}

module.exports = { sendSlackMessage, notifyDatesUpdated };
