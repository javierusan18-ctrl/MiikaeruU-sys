"""
Pipeline headless (sin interfaz grafica, sin prompts) para generar en lote
videos de SadTalker (foto+audio) y de TPSMM (foto+video de referencia).

No requiere intervencion humana: si un archivo falla o tarda demasiado,
se registra el error en el log y se continua automaticamente con el
siguiente, sin bloquear la terminal ni detener el lote completo.

Uso tipico (sin argumentos, usa todos los valores por defecto):
    python batch/batch_pipeline.py

Convencion de carpetas de entrada:
    batch_input/hablado/<nombre>.png|jpg + <nombre>.wav|mp3   (mismo nombre base)
    batch_input/cuerpo_completo/<nombre>_foto.png|jpg + <nombre>_video.mp4

Si esas carpetas estan vacias, se procesa un unico ejemplo de demostracion
por cada pipeline usando los assets de ejemplo que ya trae cada repo, para
dejar el pipeline verificado de punta a punta sin depender de contenido
que el usuario todavia no haya puesto.
"""

import argparse
import logging
import os
import subprocess
import sys
import time
from dataclasses import dataclass

warnings_env = os.environ.copy()
warnings_env["PYTHONWARNINGS"] = "ignore"

BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
SADTALKER_DIR = os.path.dirname(BATCH_DIR)
PROJECT_DIR = os.path.dirname(SADTALKER_DIR)
TPSMM_DIR = os.path.join(PROJECT_DIR, "Thin-Plate-Spline-Motion-Model")

DEFAULT_PYTHON = r"C:\Users\PC\AppData\Local\Programs\Python310-embed\python.exe"

INPUT_TALKING = os.path.join(SADTALKER_DIR, "batch_input", "hablado")
INPUT_FULLBODY = os.path.join(SADTALKER_DIR, "batch_input", "cuerpo_completo")
OUTPUT_TALKING = os.path.join(SADTALKER_DIR, "batch_output", "hablado")
OUTPUT_FULLBODY = os.path.join(SADTALKER_DIR, "batch_output", "cuerpo_completo")
LOG_PATH = os.path.join(SADTALKER_DIR, "logs", "pipeline_headless.log")
SUMMARY_PATH = os.path.join(SADTALKER_DIR, "batch_output", "resumen.txt")

IMAGE_EXTS = (".png", ".jpg", ".jpeg", ".webp")
AUDIO_EXTS = (".wav", ".mp3")
VIDEO_EXTS = (".mp4", ".mov", ".avi", ".webm")

DEMO_TALKING_IMAGE = os.path.join(SADTALKER_DIR, "examples", "source_image", "art_0.png")
DEMO_TALKING_AUDIO = os.path.join(SADTALKER_DIR, "examples", "driven_audio", "imagine.wav")
DEMO_FULLBODY_IMAGE = os.path.join(TPSMM_DIR, "assets", "source.png")
DEMO_FULLBODY_VIDEO = os.path.join(TPSMM_DIR, "assets", "driving.mp4")


def setup_logging() -> logging.Logger:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    logger = logging.getLogger("miikaeru_batch")
    logger.setLevel(logging.INFO)
    logger.handlers.clear()

    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", datefmt="%Y-%m-%d %H:%M:%S")

    file_handler = logging.FileHandler(LOG_PATH, encoding="utf-8")
    file_handler.setFormatter(fmt)
    logger.addHandler(file_handler)

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(fmt)
    logger.addHandler(console_handler)

    return logger


@dataclass
class TrabajoHablado:
    nombre: str
    imagen: str
    audio: str


@dataclass
class TrabajoCuerpoCompleto:
    nombre: str
    foto: str
    video: str


def _find_with_ext(directory: str, stem: str, exts: tuple) -> str | None:
    for ext in exts:
        candidate = os.path.join(directory, stem + ext)
        if os.path.exists(candidate):
            return candidate
    return None


def descubrir_trabajos_hablado(logger: logging.Logger) -> list[TrabajoHablado]:
    trabajos: list[TrabajoHablado] = []
    if os.path.isdir(INPUT_TALKING):
        imagenes = {
            os.path.splitext(f)[0]: f
            for f in os.listdir(INPUT_TALKING)
            if f.lower().endswith(IMAGE_EXTS)
        }
        for stem in sorted(imagenes):
            audio = _find_with_ext(INPUT_TALKING, stem, AUDIO_EXTS)
            if audio is None:
                logger.warning(
                    "hablado/%s: hay imagen pero no un audio con el mismo nombre (%s) -> se omite",
                    stem,
                    AUDIO_EXTS,
                )
                continue
            trabajos.append(
                TrabajoHablado(nombre=stem, imagen=os.path.join(INPUT_TALKING, imagenes[stem]), audio=audio)
            )

    if not trabajos:
        if os.path.exists(DEMO_TALKING_IMAGE) and os.path.exists(DEMO_TALKING_AUDIO):
            logger.info(
                "batch_input/hablado esta vacio: se procesa 1 ejemplo de demostracion "
                "para verificar el pipeline de punta a punta."
            )
            trabajos.append(
                TrabajoHablado(nombre="demo_hablado", imagen=DEMO_TALKING_IMAGE, audio=DEMO_TALKING_AUDIO)
            )
        else:
            logger.warning("No hay archivos en batch_input/hablado y tampoco assets de demostracion disponibles.")

    return trabajos


def descubrir_trabajos_cuerpo_completo(logger: logging.Logger) -> list[TrabajoCuerpoCompleto]:
    trabajos: list[TrabajoCuerpoCompleto] = []
    if os.path.isdir(INPUT_FULLBODY):
        fotos = {
            f[: -len("_foto") - len(os.path.splitext(f)[1])]: f
            for f in os.listdir(INPUT_FULLBODY)
            if f.lower().endswith(IMAGE_EXTS) and "_foto" in f.lower()
        }
        for stem in sorted(fotos):
            video = _find_with_ext(INPUT_FULLBODY, stem + "_video", VIDEO_EXTS)
            if video is None:
                logger.warning(
                    "cuerpo_completo/%s: hay foto (_foto) pero no un video con el mismo nombre (_video) -> se omite",
                    stem,
                )
                continue
            trabajos.append(
                TrabajoCuerpoCompleto(
                    nombre=stem, foto=os.path.join(INPUT_FULLBODY, fotos[stem]), video=video
                )
            )

    if not trabajos:
        if os.path.exists(DEMO_FULLBODY_IMAGE) and os.path.exists(DEMO_FULLBODY_VIDEO):
            logger.info(
                "batch_input/cuerpo_completo esta vacio: se procesa 1 ejemplo de demostracion "
                "para verificar el pipeline de punta a punta."
            )
            trabajos.append(
                TrabajoCuerpoCompleto(
                    nombre="demo_cuerpo_completo", foto=DEMO_FULLBODY_IMAGE, video=DEMO_FULLBODY_VIDEO
                )
            )
        else:
            logger.warning(
                "No hay archivos en batch_input/cuerpo_completo y tampoco assets de demostracion disponibles."
            )

    return trabajos


def ejecutar_con_timeout(
    logger: logging.Logger, cmd: list[str], timeout_s: int, etiqueta: str
) -> tuple[bool, str]:
    logger.info("Iniciando %s (timeout %ds): %s", etiqueta, timeout_s, " ".join(cmd))
    inicio = time.time()
    try:
        proc = subprocess.run(
            cmd,
            cwd=SADTALKER_DIR,
            env=warnings_env,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired:
        duracion = time.time() - inicio
        logger.error(
            "%s: EXCEDIO EL TIEMPO LIMITE (%.0fs) -> se omite este archivo y se continua con el siguiente.",
            etiqueta,
            duracion,
        )
        return False, "timeout"

    duracion = time.time() - inicio
    salida = (proc.stdout or "") + (proc.stderr or "")

    if proc.returncode != 0:
        ultimo_error = next(
            (line for line in reversed(salida.splitlines()) if line.strip()), "sin detalle"
        )
        logger.error(
            "%s: FALLO (codigo %s, %.0fs) -> %s -> se omite y se continua.",
            etiqueta,
            proc.returncode,
            duracion,
            ultimo_error,
        )
        return False, ultimo_error

    result_line = next((line for line in salida.splitlines() if line.startswith("RESULT_OK:")), None)
    if result_line:
        ruta = result_line.split("RESULT_OK:", 1)[1]
        logger.info("%s: OK (%.0fs) -> %s", etiqueta, duracion, ruta)
        return True, ruta

    logger.warning("%s: termino sin errores pero sin confirmacion clara de resultado (%.0fs).", etiqueta, duracion)
    return True, "sin_confirmacion"


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline headless de Miikaeru (sin interfaz grafica)")
    parser.add_argument("--python", default=DEFAULT_PYTHON, help="Interprete de Python a usar")
    parser.add_argument(
        "--timeout-hablado", type=int, default=2700, help="Segundos maximos por video hablado (def: 45 min)"
    )
    parser.add_argument(
        "--timeout-cuerpo-completo",
        type=int,
        default=3600,
        help="Segundos maximos por video de cuerpo completo (def: 60 min)",
    )
    parser.add_argument("--skip-hablado", action="store_true", help="No procesar la cola de videos hablados")
    parser.add_argument(
        "--skip-cuerpo-completo", action="store_true", help="No procesar la cola de videos de cuerpo completo"
    )
    args = parser.parse_args()

    logger = setup_logging()
    logger.info("=" * 70)
    logger.info("Inicio de pipeline headless de Miikaeru (modo 100%% no interactivo)")
    logger.info("=" * 70)

    resultados: list[tuple[str, str, bool, str]] = []  # (tipo, nombre, ok, detalle)

    if not args.skip_hablado:
        trabajos = descubrir_trabajos_hablado(logger)
        logger.info("Cola 'Video Hablado': %d archivo(s) por procesar.", len(trabajos))
        for trabajo in trabajos:
            cmd = [
                args.python,
                os.path.join(BATCH_DIR, "run_one_talking.py"),
                "--image", trabajo.imagen,
                "--audio", trabajo.audio,
                "--output_dir", OUTPUT_TALKING,
                "--name", trabajo.nombre,
            ]
            ok, detalle = ejecutar_con_timeout(
                logger, cmd, args.timeout_hablado, f"[hablado:{trabajo.nombre}]"
            )
            resultados.append(("hablado", trabajo.nombre, ok, detalle))
    else:
        logger.info("Cola 'Video Hablado' omitida por --skip-hablado.")

    if not args.skip_cuerpo_completo:
        trabajos_cc = descubrir_trabajos_cuerpo_completo(logger)
        logger.info("Cola 'Cuerpo Completo': %d archivo(s) por procesar.", len(trabajos_cc))
        for trabajo in trabajos_cc:
            cmd = [
                args.python,
                os.path.join(BATCH_DIR, "run_one_fullbody.py"),
                "--driving_video", trabajo.video,
                "--source_image", trabajo.foto,
                "--output_dir", OUTPUT_FULLBODY,
                "--name", trabajo.nombre,
            ]
            ok, detalle = ejecutar_con_timeout(
                logger, cmd, args.timeout_cuerpo_completo, f"[cuerpo_completo:{trabajo.nombre}]"
            )
            resultados.append(("cuerpo_completo", trabajo.nombre, ok, detalle))
    else:
        logger.info("Cola 'Cuerpo Completo' omitida por --skip-cuerpo-completo.")

    exitosos = sum(1 for _, _, ok, _ in resultados if ok)
    fallidos = len(resultados) - exitosos

    os.makedirs(os.path.dirname(SUMMARY_PATH), exist_ok=True)
    with open(SUMMARY_PATH, "w", encoding="utf-8") as f:
        f.write(f"Resumen del lote - {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Total: {len(resultados)} | Exitosos: {exitosos} | Fallidos/omitidos: {fallidos}\n\n")
        for tipo, nombre, ok, detalle in resultados:
            estado = "OK" if ok else "FALLO"
            f.write(f"[{estado}] {tipo}/{nombre}: {detalle}\n")

    logger.info("=" * 70)
    logger.info(
        "Pipeline finalizado. Total: %d | Exitosos: %d | Fallidos/omitidos: %d",
        len(resultados),
        exitosos,
        fallidos,
    )
    logger.info("Resumen guardado en: %s", SUMMARY_PATH)
    logger.info("=" * 70)


if __name__ == "__main__":
    main()
