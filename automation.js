// src/automation.js
const { getTask, getSubtasks, updateTaskDueDate } = require("./asana");
const { notifyDatesUpdated } = require("./slack");
const { SUBTASK_TEMPLATES, calculateSubtaskDate } = require("./templates");

// Procesa un cambio de due_date en una task principal
// Si tiene subtasks con nombres que coinciden con los templates, les asigna fechas automáticamente
async function processDueDateChange(taskGid) {
  try {
    console.log(`[Automation] Procesando task: ${taskGid}`);

    const task = await getTask(taskGid);

    // Solo actuar si la task tiene due date y NO es una subtask ella misma
    if (!task.due_on || task.parent) {
      console.log(`[Automation] Saltando: sin due_on o es subtask.`);
      return;
    }

    console.log(`[Automation] Task: "${task.name}" | Due: ${task.due_on}`);

    const subtasks = await getSubtasks(taskGid);
    if (!subtasks || subtasks.length === 0) {
      console.log(`[Automation] Sin subtasks, nada que hacer.`);
      return;
    }

    const updated = [];

    for (const subtask of subtasks) {
      // Buscar si esta subtask coincide con algún template (comparación flexible, case-insensitive)
      const template = SUBTASK_TEMPLATES.find((t) =>
        subtask.name.toLowerCase().trim().includes(t.name.toLowerCase().trim())
      );

      if (!template) {
        console.log(`[Automation] Subtask "${subtask.name}" no tiene template, saltando.`);
        continue;
      }

      const newDate = calculateSubtaskDate(task.due_on, template.offsetDays);

      // Solo actualizar si la fecha cambió
      if (subtask.due_on === newDate) {
        console.log(`[Automation] "${subtask.name}" ya tiene la fecha correcta (${newDate}).`);
        continue;
      }

      console.log(`[Automation] Actualizando "${subtask.name}": ${subtask.due_on} → ${newDate}`);
      await updateTaskDueDate(subtask.gid, newDate);

      updated.push({ name: subtask.name, newDate });
    }

    if (updated.length > 0) {
      console.log(`[Automation] ${updated.length} subtasks actualizadas. Notificando Slack...`);
      await notifyDatesUpdated(task.name, updated);
    } else {
      console.log(`[Automation] Ninguna subtask requirió actualización.`);
    }
  } catch (err) {
    console.error(`[Automation] Error procesando task ${taskGid}:`, err.response?.data || err.message);
  }
}

module.exports = { processDueDateChange };
