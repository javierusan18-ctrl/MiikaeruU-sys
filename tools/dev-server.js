// Servidor estático mínimo para miikaeru-web/ — usado por preview_start (ver
// .claude/launch.json) y por la IA Jugador programada (ver
// tools/ai-player/run-scheduled.js). Vive en el repo (no en una carpeta
// temporal de sesión) porque una tarea programada necesita poder arrancarlo
// semanas después de que cualquier sesión de Claude Code haya terminado.

const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "miikaeru-web");
const port = Number(process.env.PORT) || 5500;

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

const server = http
  .createServer((req, res) => {
    const urlPath = req.url.split("?")[0];
    const filePath = path.join(root, urlPath === "/" ? "/index.html" : urlPath);
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { "Content-Type": mime[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));

module.exports = server;
