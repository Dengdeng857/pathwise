"""Regression tests for the offline resume parser.

These tests deliberately use synthetic text rather than a personal resume so
they can run in CI and verify the rules that matter for real PDF extraction.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import server


def test_graduate_stage_wins_over_undergraduate_history():
    text = "北京大学软件工程硕士（2024-2027）\n本科：北京交通大学信息安全\n2027届"
    result = server.local_profile_extract(text)
    assert result["stage"].startswith("硕士")
    assert result["school"] == "北京大学"
    assert result["major"] == "软件工程"


def test_cjk_compatibility_ideographs_are_normalized():
    # U+2F24/U+2F5B are compatibility forms commonly emitted by PDF fonts.
    text = "北京⼤学\n软件⼯程硕士"
    result = server.local_profile_extract(text)
    assert result["school"] == "北京大学"
    assert result["major"] == "软件工程"


if __name__ == "__main__":
    test_graduate_stage_wins_over_undergraduate_history()
    test_cjk_compatibility_ideographs_are_normalized()
    print("local profile extraction tests passed")
