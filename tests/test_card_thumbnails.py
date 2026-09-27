import os
import shutil
import tempfile
import unittest

from PIL import Image

from backend.card_thumbnails import card_thumbnail_path, remove_card_thumbnails, snap_card_width


class CardThumbnailTests(unittest.TestCase):
    def setUp(self):
        self.root = tempfile.mkdtemp()
        self.cache_dir = os.path.join(self.root, "cache")
        self.source = os.path.join(self.root, "card.png")
        Image.new("RGB", (1200, 1800), "red").save(self.source)

    def tearDown(self):
        shutil.rmtree(self.root)

    def test_snap_card_width_rounds_up_and_caps(self):
        self.assertEqual(snap_card_width("200"), 256)
        self.assertEqual(snap_card_width(512), 512)
        self.assertEqual(snap_card_width(5000), 1024)
        self.assertIsNone(snap_card_width("x"))
        self.assertIsNone(snap_card_width(0))

    def test_builds_scaled_webp_and_reuses_it(self):
        path = card_thumbnail_path(self.source, self.cache_dir, 256)
        with Image.open(path) as image:
            self.assertEqual(image.format, "WEBP")
            self.assertEqual(image.size, (256, 384))
        first_mtime = os.stat(path).st_mtime_ns
        self.assertEqual(card_thumbnail_path(self.source, self.cache_dir, 256), path)
        self.assertEqual(os.stat(path).st_mtime_ns, first_mtime)

    def test_rebuilds_when_source_is_replaced_with_an_older_file(self):
        path = card_thumbnail_path(self.source, self.cache_dir, 256)
        Image.new("RGB", (600, 600), "blue").save(self.source)
        os.utime(self.source, ns=(1, 1))
        card_thumbnail_path(self.source, self.cache_dir, 256)
        with Image.open(path) as image:
            self.assertEqual(image.size, (256, 256))

    def test_remove_card_thumbnails_clears_every_width(self):
        card_thumbnail_path(self.source, self.cache_dir, 256)
        card_thumbnail_path(self.source, self.cache_dir, 512)
        remove_card_thumbnails(self.cache_dir, self.source)
        self.assertEqual(os.listdir(self.cache_dir), [])


if __name__ == "__main__":
    unittest.main()
