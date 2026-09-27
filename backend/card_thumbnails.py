"""Downscaled WebP copies of card thumbnails.

Card grids show thumbnails at a few hundred pixels while the stored originals are
full generations, so grids request a width and get a cached WebP instead.
"""
import glob
import os

from PIL import Image

RESIZABLE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp')
WIDTH_STEP = 128
MAX_WIDTH = 1024


def snap_card_width(value):
    """Round a requested width up to a 128px step so the cache stays small; None if invalid."""
    try:
        width = int(value)
    except (TypeError, ValueError):
        return None
    if width <= 0:
        return None
    return min(MAX_WIDTH, -(-width // WIDTH_STEP) * WIDTH_STEP)


def card_thumbnail_path(source_path, cache_dir, width):
    """Return a WebP no wider than `width`, rebuilding it when the source changes.

    The cache file carries the source mtime so a replaced thumbnail is picked up
    even when the new file keeps an older timestamp (shutil.copy2).
    """
    stem = os.path.splitext(os.path.basename(source_path))[0]
    cache_path = os.path.join(cache_dir, f"{stem}-{width}.webp")
    source_mtime = os.stat(source_path).st_mtime_ns
    try:
        if os.stat(cache_path).st_mtime_ns == source_mtime:
            return cache_path
    except FileNotFoundError:
        pass

    os.makedirs(cache_dir, exist_ok=True)
    temp_path = f"{cache_path}.{os.getpid()}.tmp"
    with Image.open(source_path) as image:
        image.thumbnail((width, width * 4))
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA")
        image.save(temp_path, "WEBP", quality=82, method=4)
    os.utime(temp_path, ns=(source_mtime, source_mtime))
    os.replace(temp_path, cache_path)
    return cache_path


def remove_card_thumbnails(cache_dir, source_path):
    stem = os.path.splitext(os.path.basename(source_path))[0]
    for path in glob.glob(os.path.join(glob.escape(cache_dir), f"{glob.escape(stem)}-*.webp")):
        try:
            os.remove(path)
        except OSError as e:
            print(f"Error removing cached card thumbnail {path}: {e}")
