"""
Envoltorio simple sobre demo.py de Thin-Plate-Spline-Motion-Model para poder
llamarlo como funcion (en vez de linea de comandos) desde la interfaz Gradio.
"""

import os

import imageio
import numpy as np
import torch
from skimage import img_as_ubyte
from skimage.transform import resize

from demo import load_checkpoints, make_animation

REPO_DIR = os.path.dirname(os.path.abspath(__file__))

_MODEL_CACHE: dict[str, tuple] = {}


def _load_model(config_path: str, checkpoint_path: str, device: torch.device):
    cache_key = f"{config_path}|{checkpoint_path}|{device}"
    if cache_key not in _MODEL_CACHE:
        _MODEL_CACHE[cache_key] = load_checkpoints(config_path, checkpoint_path, device)
    return _MODEL_CACHE[cache_key]


def generate_full_body_video(
    source_image_path: str,
    driving_video_path: str,
    result_video_path: str,
    config_path: str = os.path.join(REPO_DIR, "config", "taichi-256.yaml"),
    checkpoint_path: str = os.path.join(REPO_DIR, "checkpoints", "taichi.pth.tar"),
    img_shape: tuple[int, int] = (256, 256),
    mode: str = "relative",
    cpu: bool = True,
) -> str:
    """Anima source_image_path siguiendo el movimiento de driving_video_path.
    Devuelve la ruta del video generado (sin audio, solo transferencia de movimiento)."""

    device = torch.device("cpu") if cpu else torch.device("cuda")

    source_image = imageio.imread(source_image_path)
    reader = imageio.get_reader(driving_video_path)
    fps = reader.get_meta_data()["fps"]
    driving_video = []
    try:
        for frame in reader:
            driving_video.append(frame)
    except RuntimeError:
        pass
    reader.close()

    source_image = resize(source_image, img_shape)[..., :3]
    driving_video = [resize(frame, img_shape)[..., :3] for frame in driving_video]

    inpainting, kp_detector, dense_motion_network, avd_network = _load_model(
        config_path, checkpoint_path, device
    )

    predictions = make_animation(
        source_image,
        driving_video,
        inpainting,
        kp_detector,
        dense_motion_network,
        avd_network,
        device=device,
        mode=mode,
    )

    os.makedirs(os.path.dirname(result_video_path) or ".", exist_ok=True)
    imageio.mimsave(result_video_path, [img_as_ubyte(frame) for frame in predictions], fps=fps)
    return result_video_path
