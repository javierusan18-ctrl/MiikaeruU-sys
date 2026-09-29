"""
Genera UN video hablado (SadTalker) de forma totalmente no interactiva.
Pensado para ser invocado como subproceso desde batch_pipeline.py, con un
timeout externo que lo puede matar sin dejar nada bloqueado.

Salida por stdout (para que el orquestador la pueda leer sin parsear logs):
    RESULT_OK:<ruta del mp4 final>
    RESULT_FAIL:<motivo>
"""

import argparse
import os
import shutil
import sys
import tempfile
import warnings

warnings.filterwarnings("ignore")

BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
SADTALKER_DIR = os.path.dirname(BATCH_DIR)
os.chdir(SADTALKER_DIR)
sys.path.insert(0, SADTALKER_DIR)
os.environ["CUDA_VISIBLE_DEVICES"] = ""


def ensure_ffmpeg_on_path() -> None:
    import imageio_ffmpeg

    bin_dir = os.path.join(SADTALKER_DIR, "bin")
    ffmpeg_path = os.path.join(bin_dir, "ffmpeg.exe")
    if not os.path.exists(ffmpeg_path):
        os.makedirs(bin_dir, exist_ok=True)
        shutil.copy(imageio_ffmpeg.get_ffmpeg_exe(), ffmpeg_path)
    if bin_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = bin_dir + os.pathsep + os.environ.get("PATH", "")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", required=True)
    parser.add_argument("--audio", required=True)
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--name", required=True, help="Nombre base para el mp4 final")
    args = parser.parse_args()

    tmp_dir = tempfile.mkdtemp(prefix="miikaeru_talking_")
    try:
        ensure_ffmpeg_on_path()
        from src.gradio_demo import SadTalker

        # Copiamos las entradas a una carpeta temporal: SadTalker MUEVE los
        # archivos originales al procesarlos, y no queremos borrar los
        # archivos del usuario en batch_input/.
        img_copy = os.path.join(tmp_dir, os.path.basename(args.image))
        audio_copy = os.path.join(tmp_dir, os.path.basename(args.audio))
        shutil.copy(args.image, img_copy)
        shutil.copy(args.audio, audio_copy)

        sad_talker = SadTalker(checkpoint_path="checkpoints", config_path="src/config")
        result_path = sad_talker.test(
            source_image=img_copy,
            driven_audio=audio_copy,
            preprocess="full",
            still_mode=True,
            use_enhancer=False,
            batch_size=1,
            size=256,
            pose_style=0,
            result_dir=tmp_dir,
        )

        os.makedirs(args.output_dir, exist_ok=True)
        final_path = os.path.join(args.output_dir, f"{args.name}.mp4")
        shutil.copy(result_path, final_path)
        print(f"RESULT_OK:{final_path}")
        return 0
    except Exception as exc:  # noqa: BLE001 - queremos capturar todo y seguir
        print(f"RESULT_FAIL:{exc}")
        return 1
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
