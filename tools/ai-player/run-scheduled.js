#!/usr/bin/env node
// Punto de entrada para una corrida PROGRAMADA (Windows Task Scheduler, ver
// tools/ai-player/README.md § Corrida programada) — a diferencia de
// player.js (que asume que vos ya tenés el server local corriendo, porque lo
// estás mirando en el navegador), esto levanta tools/dev-server.js solo,
// espera a que conteste, corre player.js, y lo apaga al final. Pensado para
// correr sin nadie mirando: todo lo que hubiera ido a la consola queda
// además en tools/ai-player/logs/.
//
// Sigue siendo SOLO un reporter: player.js únicamente inserta filas
// "pending" en automation_tasks (ver README.md y config.js) — nunca modifica
// código. Un humano sigue aprobando/descartando desde el Panel de
// Administrador.

const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const PORT = 5500;
const TARGET_URL = `http://localhost:${PORT}`;
const LOG_DIR = path.join(__dirname, "logs");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    (function poll() {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() > deadline) {
            reject(new Error(`El servidor local no contestó en ${timeoutMs}ms (${url})`));
            return;
          }
          setTimeout(poll, 300);
        });
    })();
  });
}

async function main() {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const logPath = path.join(LOG_DIR, `run-${timestamp()}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: "a" });
  const log = (line) => {
    const withTime = `[${new Date().toISOString()}] ${line}`;
    console.log(withTime);
    logStream.write(withTime + "\n");
  };

  log(`=== Corrida programada de la IA Jugador ===`);

  const devServer = spawn(process.execPath, [path.join(ROOT, "tools", "dev-server.js")], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  devServer.stdout.on("data", (d) => log(`[dev-server] ${d.toString().trim()}`));
  devServer.stderr.on("data", (d) => log(`[dev-server:err] ${d.toString().trim()}`));

  let exitCode = 1;
  try {
    log(`Esperando que ${TARGET_URL} conteste...`);
    await waitForServer(TARGET_URL, 15000);
    log("Servidor local listo. Arrancando player.js...");

    exitCode = await new Promise((resolve) => {
      const player = spawn(
        process.execPath,
        [path.join(__dirname, "player.js"), "--max-actions", "40", "--max-findings", "10"],
        { cwd: __dirname, stdio: ["ignore", "pipe", "pipe"] }
      );
      player.stdout.on("data", (d) => log(d.toString().trimEnd()));
      player.stderr.on("data", (d) => log(`[err] ${d.toString().trimEnd()}`));
      player.on("close", (code) => resolve(code ?? 1));
      player.on("error", (err) => {
        log(`Error al lanzar player.js: ${err.message}`);
        resolve(1);
      });
    });
  } catch (err) {
    log(`Error: ${err.message}`);
  } finally {
    log("Apagando servidor local...");
    devServer.kill();
    log(`=== Fin de corrida (exit ${exitCode}) — log en ${logPath} ===`);
    logStream.end();
  }

  process.exit(exitCode);
}

main();
