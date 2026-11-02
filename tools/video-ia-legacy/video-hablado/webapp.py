"""
Interfaz web local combinada (Gradio) para dos herramientas:

1. SadTalker: sube una foto + un audio con una voz -> video donde la foto "habla".
2. Thin-Plate-Spline-Motion-Model (TPSMM): sube un video de referencia con movimiento
   (baile) + una foto de cuerpo completo (mascota o bebe) -> video donde la foto
   reproduce ese movimiento.

Ambas corren en CPU (no se requiere GPU NVIDIA).

Uso:
    python webapp.py [--cpu] [--port 7860]
"""

import argparse
import os
import shutil
import sys
import uuid

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(SCRIPT_DIR)
sys.path.insert(0, SCRIPT_DIR)

# Si se lanza con pythonw.exe (sin consola), sys.stdout/stderr quedan en None y
# cualquier print() de las librerias internas haria crashear la app. Redirigimos
# a un archivo de log para que la app quede estable sin ventana de terminal.
if sys.stdout is None or sys.stderr is None:
    LOG_DIR = os.path.join(SCRIPT_DIR, "logs")
    os.makedirs(LOG_DIR, exist_ok=True)
    _log_file = open(os.path.join(LOG_DIR, "webapp.log"), "a", encoding="utf-8", buffering=1)
    sys.stdout = _log_file
    sys.stderr = _log_file

TPSMM_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "Thin-Plate-Spline-Motion-Model"))
sys.path.insert(0, TPSMM_DIR)

# Este equipo no tiene GPU NVIDIA: forzar CPU antes de que torch se inicialice.
os.environ["CUDA_VISIBLE_DEVICES"] = ""

import gradio as gr
import imageio_ffmpeg

from src.gradio_demo import SadTalker
from tpsmm_infer import generate_full_body_video

CHECKPOINT_DIR = "checkpoints"
CONFIG_DIR = "src/config"
RESULT_DIR = "results/webapp"

TPSMM_RESULT_DIR = os.path.join(TPSMM_DIR, "results", "webapp")
TPSMM_CONFIG = os.path.join(TPSMM_DIR, "config", "taichi-256.yaml")
TPSMM_CHECKPOINT = os.path.join(TPSMM_DIR, "checkpoints", "taichi.pth.tar")

CUSTOM_CSS = """
footer { display: none !important; }
.gradio-container { max-width: 1100px !important; margin: 0 auto !important; }
#cabecera { text-align: center; margin-bottom: 0.5rem; }
#cabecera h1 { margin-bottom: 0.2rem; }
.tarjeta { border-radius: 14px; }
"""

TEMA = gr.themes.Soft(
    primary_hue="violet",
    secondary_hue="purple",
    neutral_hue="slate",
    font=[gr.themes.GoogleFont("Inter"), "ui-sans-serif", "system-ui", "sans-serif"],
)

# Gradio no traduce ciertos textos internos (aria-label/title de los iconos de subir
# archivo, camara, microfono, etc.) aunque el navegador este en espanol. Este script
# los corrige en el cliente, incluso los que aparecen despues de cargar la pagina.
JS_TRADUCCIONES = """
() => {
  const dict = {
    "Upload file": "Subir archivo",
    "Capture from camera": "Capturar con la camara",
    "Paste from clipboard": "Pegar desde el portapapeles",
    "Record audio": "Grabar audio",
    "Clear": "Borrar",
    "Download": "Descargar",
    "Share": "Compartir",
    "Fullscreen": "Pantalla completa",
    "Play": "Reproducir",
    "Pause": "Pausar",
    "Mute": "Silenciar",
    "Unmute": "Activar sonido",
    "Settings": "Configuracion",
    "Submit": "Enviar",
    "Stop": "Detener",
    "Flag": "Marcar",
    "Undo": "Deshacer",
    "Redo": "Rehacer",
    "Trim": "Recortar",
    "Volume": "Volumen",
    "Loop": "Repetir",
    "Skip": "Saltar",
    "Use via API": "Usar via API",
    "Built with Gradio": "Hecho con Gradio",
    "View API": "Ver API",
    "More tabs": "Mas pestanas",
    "File upload": "Subir archivo",
    "Empty value": "Sin valor",
    "Gradio footer navigation": "Pie de pagina",
  };

  function traducirNodo(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    for (const attr of ["aria-label", "title", "placeholder"]) {
      const val = node.getAttribute && node.getAttribute(attr);
      if (val && dict[val.trim()]) {
        node.setAttribute(attr, dict[val.trim()]);
      }
    }
  }

  function recorrer(root) {
    traducirNodo(root);
    if (root.querySelectorAll) {
      root.querySelectorAll("*").forEach(traducirNodo);
    }
  }

  recorrer(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => recorrer(n));
      if (m.type === "attributes") traducirNodo(m.target);
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "title", "placeholder"],
  });
}
"""


def ensure_ffmpeg_on_path() -> None:
    """SadTalker invoca el comando 'ffmpeg' por linea de comandos para unir audio y video.
    El binario que trae imageio-ffmpeg no se llama 'ffmpeg.exe' (p.ej. 'ffmpeg-win64-v4.2.2.exe'),
    asi que cmd.exe no lo reconoce por PATH aunque su carpeta este incluida. Lo copiamos una
    sola vez con el nombre correcto a bin/ffmpeg.exe."""
    bin_dir = os.path.join(SCRIPT_DIR, "bin")
    ffmpeg_path = os.path.join(bin_dir, "ffmpeg.exe")
    if not os.path.exists(ffmpeg_path):
        os.makedirs(bin_dir, exist_ok=True)
        shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), ffmpeg_path)
    if bin_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


ensure_ffmpeg_on_path()
sad_talker = SadTalker(checkpoint_path=CHECKPOINT_DIR, config_path=CONFIG_DIR)


def generate_talking_video(
    source_image: str,
    driven_audio: str,
    progress: gr.Progress = gr.Progress(track_tqdm=True),
) -> str:
    if source_image is None:
        raise gr.Error("Sube una imagen antes de generar el video.")
    if driven_audio is None:
        raise gr.Error("Sube un archivo de audio antes de generar el video.")

    progress(0, desc="Preparando modelos...")
    try:
        return sad_talker.test(
            source_image=source_image,
            driven_audio=driven_audio,
            preprocess="full",
            still_mode=True,
            use_enhancer=False,
            batch_size=1,
            size=256,
            pose_style=0,
            result_dir=RESULT_DIR,
        )
    except Exception as exc:
        raise gr.Error(f"No se pudo generar el video: {exc}") from exc


def generate_fullbody_video(
    driving_video: str,
    source_image: str,
    progress: gr.Progress = gr.Progress(track_tqdm=True),
) -> str:
    if driving_video is None:
        raise gr.Error("Sube un video de referencia con el movimiento/baile.")
    if source_image is None:
        raise gr.Error("Sube una foto de cuerpo completo antes de generar el video.")
    if not os.path.exists(TPSMM_CHECKPOINT):
        raise gr.Error(f"No se encontro el checkpoint de TPSMM en {TPSMM_CHECKPOINT}")

    progress(0, desc="Preparando modelos...")
    os.makedirs(TPSMM_RESULT_DIR, exist_ok=True)
    result_path = os.path.join(TPSMM_RESULT_DIR, f"{uuid.uuid4()}.mp4")

    try:
        return generate_full_body_video(
            source_image_path=source_image,
            driving_video_path=driving_video,
            result_video_path=result_path,
            config_path=TPSMM_CONFIG,
            checkpoint_path=TPSMM_CHECKPOINT,
            cpu=True,
        )
    except Exception as exc:
        raise gr.Error(f"No se pudo generar el video: {exc}") from exc


def build_interface() -> gr.Blocks:
    with gr.Blocks(title="Miikaeru - Generador de Video con IA", theme=TEMA, css=CUSTOM_CSS) as demo:
        with gr.Column(elem_id="cabecera"):
            gr.Markdown(
                "# 🎬 Miikaeru — Generador de Video con IA\n"
                "Todo se procesa en este equipo (CPU), sin conexion a servidores externos. "
                "Cada generacion puede tardar varios minutos: la barra de progreso muestra "
                "la etapa actual y el tiempo estimado restante."
            )

        with gr.Tabs():
            with gr.Tab("🗣️ Video Hablado"):
                gr.Markdown(
                    "Sube una foto (bebe o mascota) y un audio con una voz. "
                    "La foto **habla** siguiendo ese audio."
                )
                with gr.Row():
                    with gr.Column(scale=1):
                        with gr.Group(elem_classes="tarjeta"):
                            talk_image = gr.Image(label="Foto (bebe o mascota)", type="filepath")
                            talk_audio = gr.Audio(label="Audio con la voz", type="filepath")
                            talk_btn = gr.Button("🎙️ Generar Video Hablado", variant="primary", size="lg")
                    with gr.Column(scale=1):
                        with gr.Group(elem_classes="tarjeta"):
                            talk_output = gr.Video(label="Video resultado", autoplay=True)

                talk_btn.click(
                    fn=generate_talking_video,
                    inputs=[talk_image, talk_audio],
                    outputs=[talk_output],
                )

            with gr.Tab("💃 Cuerpo Completo (Baile)"):
                gr.Markdown(
                    "Sube un video de referencia con un movimiento o baile, y una foto de "
                    "**cuerpo completo** (mascota o bebe). La foto reproduce ese movimiento. "
                    "El video resultado no lleva audio."
                )
                with gr.Row():
                    with gr.Column(scale=1):
                        with gr.Group(elem_classes="tarjeta"):
                            fullbody_driving_video = gr.Video(label="Video de referencia (movimiento/baile)")
                            fullbody_source_image = gr.Image(
                                label="Foto de cuerpo completo (mascota o bebe)", type="filepath"
                            )
                            fullbody_btn = gr.Button(
                                "💃 Generar Video de Cuerpo Completo", variant="primary", size="lg"
                            )
                    with gr.Column(scale=1):
                        with gr.Group(elem_classes="tarjeta"):
                            fullbody_output = gr.Video(label="Video resultado", autoplay=True)

                fullbody_btn.click(
                    fn=generate_fullbody_video,
                    inputs=[fullbody_driving_video, fullbody_source_image],
                    outputs=[fullbody_output],
                )

        gr.Markdown(
            "<center><sub>Miikaeru · Procesamiento 100% local en CPU</sub></center>"
        )

        demo.load(fn=None, inputs=None, outputs=None, js=JS_TRADUCCIONES)

    return demo


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Interfaz web local de Miikaeru (SadTalker + TPSMM)")
    parser.add_argument(
        "--cpu",
        action="store_true",
        default=True,
        help="Forzar ejecucion en CPU (activado por defecto: no hay GPU NVIDIA en este equipo)",
    )
    parser.add_argument("--port", type=int, default=7860, help="Puerto local de la interfaz")
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()

    demo = build_interface()
    demo.queue()

    port = args.port
    last_error = None
    for attempt in range(5):
        try:
            demo.launch(server_name="127.0.0.1", server_port=port, inbrowser=True)
            last_error = None
            break
        except OSError as exc:
            last_error = exc
            port += 1
    if last_error is not None:
        raise last_error
