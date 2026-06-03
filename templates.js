// config/templates.js
// Define aquí los offsets de días para cada subtask
// El offset es negativo = días ANTES del due date de la task principal

const SUBTASK_TEMPLATES = [
  {
    name: "Copy Due",
    offsetDays: -14,  // due_date - 14 días
  },
  {
    name: "Client's Approval",
    offsetDays: -12,  // due_date - 12 días
  },
  {
    name: "Klaviyo Setup",
    offsetDays: -10,  // due_date - 10 días
  },
  {
    name: "Scheduled",
    offsetDays: -7,   // due_date - 7 días
  },
];

// Función para calcular la fecha de una subtask dado el due date principal
function calculateSubtaskDate(mainDueDate, offsetDays) {
  const date = new Date(mainDueDate);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().split("T")[0]; // formato YYYY-MM-DD
}

module.exports = { SUBTASK_TEMPLATES, calculateSubtaskDate };
