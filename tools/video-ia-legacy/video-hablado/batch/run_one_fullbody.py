"""
Genera UN video de cuerpo completo (TPSMM) de forma totalmente no interactiva.
Pensado para ser invocado como subproceso desde batch_pipeline.py, con un
timeout externo que lo puede matar sin dejar nada bloqueado.

Salida por stdout:
    RESULT_OK:<ruta del mp4 final>
    RESULT_FAIL:<motivo>
"""

import argparse
import os
import shutil
import sys
import warnings

warnings.filterwarnings("ignore")

BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
SADTALKER_DIR = os.path.dirname(BATCH_DIR)
TPSMM_DIR = os.path.abspath(os.path.join(SADTALKER_DIR, "..", "Thin-Plate-Spline-Motion-Model"))
sys.path.insert(0, TPSMM_DIR)
os.environ["CUDA_VISIBLE_DEVICES"] = ""

TPSMM_CONFIG = os.path.join(TPSMM_DIR, "config", "taichi-256.yaml")
TPSMM_CHECKPOINT = os.path.join(TPSMM_DIR, "checkpoints", "taichi.pth.tar")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--driving_video", required=True)
    parser.add_argument("--source_image", required=True)
    parser.add_argument("--output_dir", required=True)
    parser.add_argument("--name", required=True, help="Nombre base para el mp4 final")
    args = parser.parse_args()

    try:
        if not os.path.exists(TPSMM_CHECKPOINT):
            raise FileNotFoundError(f"No se encontro el checkpoint de TPSMM en {TPSMM_CHECKPOINT}")

        from tpsmm_infer import generate_full_body_video

        os.makedirs(args.output_dir, exist_ok=True)
        final_path = os.path.join(args.output_dir, f"{args.name}.mp4")

        generate_full_body_video(
            source_image_path=args.source_image,
            driving_video_path=args.driving_video,
            result_video_path=final_path,
            config_path=TPSMM_CONFIG,
            checkpoint_path=TPSMM_CHECKPOINT,
            cpu=True,
        )
        print(f"RESULT_OK:{final_path}")
        return 0
    except Exception as exc:  # noqa: BLE001 - queremos capturar todo y seguir
        print(f"RESULT_FAIL:{exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
