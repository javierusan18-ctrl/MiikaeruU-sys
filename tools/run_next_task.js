#!/usr/bin/env node
// Lector/selector de la cola de tareas aprobadas (approved_tasks.json, ver
// AUTOMATION_WORKFLOW.md en la raíz). A PROPÓSITO no modifica ningún
// archivo del proyecto salvo approved_tasks.json mismo (para actualizar el
// status de una tarea) — no hay repositorio git en este proyecto, así que
// un ejecutor que tocara app.js/style.css/index.html de forma automática
// no tendría cómo revertirse si algo sale mal. El cambio de código real lo
// sigue aplicando un humano o una sesión de Claude Code, tomando la tarea
// que este script señala como "siguiente".
//
// Uso:
//   node tools/run_next_task.js                  → muestra la próxima tarea pending
//   node tools/run_next_task.js --list            → lista todas las tareas con su status
//   node tools/run_next_task.js --complete <id> ["notas"]  → marca una tarea completed
//   node tools/run_next_task.js --fail <id> ["notas"]      → marca una tarea failed

const fs = require("fs");
const path = require("path");

const QUEUE_PATH = path.join(__dirname, "..", "approved_tasks.json");
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function loadQueue() {
  if (!fs.existsSync(QUEUE_PATH)) {
    console.error(`No se encontró ${QUEUE_PATH}. Ver AUTOMATION_WORKFLOW.md.`);
    process.exit(1);
  }
  const raw = fs.readFileSync(QUEUE_PATH, "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`${QUEUE_PATH} tiene un JSON inválido: ${err.message}`);
    process.exit(1);
  }
}

function saveQueue(queue) {
  fs.writeFileSync(QUEUE_PATH, JSON.stringify(queue, null, 2) + "\n", "utf8");
}

function formatTask(task) {
  const lines = [
    `[${task.id}] ${task.title}`,
    `  tipo:       ${task.type}`,
    `  prioridad:  ${task.priority}`,
    `  status:     ${task.status}`,
    `  origen:     ${task.source}`,
    `  archivos:   ${(task.affectedFiles || []).join(", ") || "(ninguno indicado)"}`,
    `  descripción:`,
    `    ${task.description}`,
  ];
  if (task.notes) lines.push(`  notas:      ${task.notes}`);
  return lines.join("\n");
}

function nextPendingTask(queue) {
  const pending = queue.tasks.filter((t) => t.status === "pending");
  if (!pending.length) return null;
  return [...pending].sort((a, b) => {
    const rankDiff = (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.createdAt) - new Date(b.createdAt);
  })[0];
}

function cmdList(queue) {
  if (!queue.tasks.length) {
    console.log("La cola está vacía.");
    return;
  }
  queue.tasks.forEach((task, i) => {
    if (i > 0) console.log("");
    console.log(formatTask(task));
  });
}

function cmdNext(queue) {
  const task = nextPendingTask(queue);
  if (!task) {
    console.log("No hay tareas pending en la cola.");
    return;
  }
  console.log("Próxima tarea pending (por prioridad y antigüedad):\n");
  console.log(formatTask(task));
}

function cmdSetStatus(queue, id, status, notes) {
  const task = queue.tasks.find((t) => t.id === id);
  if (!task) {
    console.error(`No existe ninguna tarea con id "${id}".`);
    process.exit(1);
  }
  if (task.status !== "pending") {
    console.warn(`Aviso: la tarea "${id}" ya estaba en status "${task.status}", se sobrescribe a "${status}".`);
  }
  task.status = status;
  task.completedAt = new Date().toISOString();
  if (notes) task.notes = notes;
  saveQueue(queue);
  console.log(`Tarea "${id}" marcada como "${status}".`);
}

function main() {
  const args = process.argv.slice(2);
  const queue = loadQueue();

  if (args.includes("--list")) {
    cmdList(queue);
    return;
  }

  const completeIdx = args.indexOf("--complete");
  if (completeIdx !== -1) {
    const id = args[completeIdx + 1];
    const notes = args[completeIdx + 2];
    if (!id) {
      console.error("Uso: node tools/run_next_task.js --complete <id> [\"notas\"]");
      process.exit(1);
    }
    cmdSetStatus(queue, id, "completed", notes);
    return;
  }

  const failIdx = args.indexOf("--fail");
  if (failIdx !== -1) {
    const id = args[failIdx + 1];
    const notes = args[failIdx + 2];
    if (!id) {
      console.error("Uso: node tools/run_next_task.js --fail <id> [\"notas\"]");
      process.exit(1);
    }
    cmdSetStatus(queue, id, "failed", notes);
    return;
  }

  cmdNext(queue);
}

main();
