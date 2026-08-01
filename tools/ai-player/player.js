#!/usr/bin/env node
// Punto de entrada de la IA Jugador. Ver README.md para prerrequisitos y
// uso. config.js valida (y tira si algo falta) ANTHROPIC_API_KEY,
// SUPABASE_URL/KEY, y que TARGET_URL sea local antes de que este archivo
// llegue a abrir un navegador.

const config = require("./config");
const { BrowserSession } = require("./lib/browser");
const { createWriter } = require("./lib/supabase-writer");
const { runSession } = require("./lib/claude-player");

function parseArgs(argv) {
  const args = { maxActions: config.defaultMaxActions, maxFindings: config.defaultMaxFindings, dryRun: false, url: config.targetUrl };
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--max-actions":
        args.maxActions = parseInt(argv[++i], 10);
        break;
      case "--max-findings":
        args.maxFindings = parseInt(argv[++i], 10);
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--url":
        args.url = argv[++i];
        break;
      default:
        console.error(`Argumento desconocido: ${argv[i]}`);
        console.error("Uso: node player.js [--max-actions N] [--max-findings N] [--dry-run] [--url <url>]");
        process.exit(1);
    }
  }
  return args;
}

function onEvent(event, detail) {
  const timestamp = new Date().toISOString().slice(11, 19);
  switch (event) {
    case "click":
      console.log(`[${timestamp}] 🖱️  clic en ${detail.role} "${detail.name}"`);
      break;
    case "type_text":
      console.log(`[${timestamp}] ⌨️  texto en ${detail.role} "${detail.name}"`);
      break;
    case "screenshot":
      console.log(`[${timestamp}] 📸 captura tomada`);
      break;
    case "read_console_errors":
      if (detail.count > 0) console.log(`[${timestamp}] ⚠️  ${detail.count} error(es) de consola leídos`);
      break;
    case "finding":
      console.log(`[${timestamp}] 🐞 hallazgo: "${detail.title}" (${detail.type}/${detail.priority})`);
      break;
    case "finish_session":
      console.log(`[${timestamp}] 🏁 fin de sesión: ${detail.summary}`);
      break;
    default:
      break;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("=== IA Jugador — Miikaeru_SYS ===");
  console.log(`Objetivo: ${args.url}`);
  console.log(`Límites: ${args.maxActions} acciones, ${args.maxFindings} hallazgos${args.dryRun ? " (--dry-run: no escribe en Supabase)" : ""}`);
  console.log("");

  const browserSession = new BrowserSession();
  const supabaseWriter = createWriter(config);

  try {
    await browserSession.launch(args.url);
    const result = await runSession({
      config,
      browserSession,
      supabaseWriter,
      maxActions: args.maxActions,
      maxFindings: args.maxFindings,
      dryRun: args.dryRun,
      onEvent,
    });

    console.log("");
    console.log("=== Resumen ===");
    console.log(`Terminó por su cuenta (finish_session): ${result.finished ? "sí" : "no — cortada por límite"}`);
    console.log(`Acciones usadas: ${result.actionsUsed}/${args.maxActions}`);
    console.log(`Hallazgos reportados: ${result.findingsReported}/${args.maxFindings}`);
    if (result.summary) console.log(`Resumen del modelo: ${result.summary}`);
  } finally {
    await browserSession.close();
  }
}

main().catch((err) => {
  console.error("Error fatal:", err.message);
  process.exit(1);
});
