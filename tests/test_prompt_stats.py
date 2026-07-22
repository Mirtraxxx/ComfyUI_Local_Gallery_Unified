import unittest

from backend.prompt_stats import build_prompt_stats, query_prompt_stats, split_prompt_tags


class PromptStatsTests(unittest.TestCase):
    def test_split_prompt_tags_preserves_escaped_character_franchise(self):
        self.assertEqual(
            split_prompt_tags(r"1girl, solo, kaede \(blue archive\), (smile:1.2)"),
            ["1girl", "solo", r"kaede \(blue archive\)", "smile"],
        )

    def test_split_prompt_tags_counts_tags_inside_attention_groups(self):
        self.assertEqual(
            split_prompt_tags("(1girl, solo, (smile:1.2))"),
            ["1girl", "solo", "smile"],
        )

    def test_counts_each_tag_once_per_card_and_extracts_explicit_types(self):
        metadata = {
            "one": {"category": "people", "prompt_text": r"1girl, solo, 1girl, kaede \(blue archive\)"},
            "two": {"category": "people", "prompt_text": r"1girl, rapi \(nikke\)"},
            "three": {"category": "poses", "prompt_text": "solo, standing"},
        }
        aggregate = build_prompt_stats(metadata)
        all_tags = query_prompt_stats(aggregate, group="all", per_page=100)["entries"]
        counts = {entry["tag"]: entry["count"] for entry in all_tags}
        self.assertEqual(counts["1girl"], 2)
        self.assertEqual(counts["solo"], 2)

        characters = query_prompt_stats(aggregate, group="characters", per_page=100)["entries"]
        self.assertEqual({entry["tag"] for entry in characters}, {"kaede", "rapi"})
        franchises = query_prompt_stats(aggregate, group="franchises", per_page=100)["entries"]
        self.assertEqual({entry["tag"] for entry in franchises}, {"blue archive", "nikke"})

    def test_category_scope_and_cross_category_breakdown(self):
        metadata = {
            "one": {"category": "a", "prompt_text": "solo"},
            "two": {"category": "b", "prompt_text": "solo"},
            "three": {"category": "b", "prompt_text": "solo, 1girl"},
        }
        aggregate = build_prompt_stats(metadata)
        solo = query_prompt_stats(aggregate, search="solo", per_page=100)["entries"][0]
        self.assertEqual(solo["count"], 3)
        self.assertEqual(solo["categories"], [
            {"category": "b", "count": 2},
            {"category": "a", "count": 1},
        ])

        category_aggregate = build_prompt_stats(metadata, category="b")
        self.assertEqual(category_aggregate["card_count"], 2)

    def test_artist_qualifiers_are_not_reported_as_characters_or_franchises(self):
        metadata = {
            "one": {"category": "Artists", "prompt_text": r"by yuu \(pixiv\)"},
            "two": {"category": "mixed", "prompt_text": r"someone \(artist\)"},
        }
        aggregate = build_prompt_stats(metadata)
        self.assertEqual(query_prompt_stats(aggregate, group="characters")["entries"], [])
        self.assertEqual(query_prompt_stats(aggregate, group="franchises")["entries"], [])


if __name__ == "__main__":
    unittest.main()
