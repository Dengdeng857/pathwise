#!/usr/bin/env python3
"""Turn raw public pages into conservative, searchable case records.

This is deterministic curation. It intentionally does not invent outcomes or
facts that are absent from the source text; uncertain records stay pending.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

TYPE_RULES = {
    "jd": ("岗位职责", "职位描述", "任职要求", "职位要求", "招聘", "校招", "实习生"),
    "interview": ("面经", "面试", "一面", "二面", "三面", "面试官", "追问"),
    "career_path": ("转行", "拿到 offer", "offer", "求职经历", "实习经历", "秋招", "春招"),
    "project_pattern": ("项目复盘", "项目经历", "产品设计", "用户痛点", "指标", "上线"),
}
ROLE_TERMS = ("AI产品", "产品经理", "数据产品", "风控", "安全", "算法", "研发", "运营", "电商")
SKILL_TERMS = ("Python", "SQL", "数据分析", "用户研究", "A/B测试", "大模型", "Agent", "代码审计", "项目管理")


def classify(title, text):
    blob = f"{title} {text[:12000]}".lower()
    scores = {kind: sum(blob.count(term.lower()) for term in terms) for kind, terms in TYPE_RULES.items()}
    kind, score = max(scores.items(), key=lambda pair: pair[1])
    return kind if score >= 2 else "reference"


def terms_in(text, terms):
    return [term for term in terms if term.lower() in text.lower()]


def sentence_chunks(text, limit=6):
    chunks = [re.sub(r"\s+", " ", item).strip() for item in re.split(r"[。！？!?\n]", text)]
    return [item[:180] for item in chunks if len(item) >= 18][:limit]


def quality_score(title, text):
    markers = ("面试", "面经", "实习", "求职", "岗位", "职责", "项目", "offer", "指标", "结果", "复盘")
    marker_score = min(6, sum(text.lower().count(term.lower()) for term in markers))
    unique_ratio = len(set(text.split())) / max(1, len(text.split()))
    shell_penalty = sum(text.count(term) for term in ("扫描二维码", "请添加一段描述性文字", "立即投递 收藏"))
    return marker_score + min(2, unique_ratio * 2) - min(5, shell_penalty)


def curate(item):
    title = str(item.get("title") or "").strip()
    text = str(item.get("text") or "").strip()
    url = str(item.get("url") or "")
    # Exclude coding exercise pages, user homepages and generic site shells.
    # They contain useful words such as "面试" but are not career evidence.
    blocked_paths = ("/practice/", "/exam/", "/users/", "/courses", "/app", "/html/", "/nowcoder/", "/simple/", "/jump", "/interview/ai", "/jobs/")
    blocked_titles = ("牛客网 -", "牛客题霸", "个人主页动态", "牛客大会员", "联系我们", "免责申明", "友情链接", "关于牛客", "AI模拟面试", "应届生求职网站", "牛客网校招日程", "精品专栏文章")
    shell_markers = ("请添加一段描述性文字", "参数不能为空", "扫描二维码，关注牛客网")
    if any(path in url for path in blocked_paths) or any(prefix in title for prefix in blocked_titles) or sum(marker in text for marker in shell_markers) >= 2:
        return None
    if len(text) < 360 or not item.get("url") or quality_score(title, text) < 3.2:
        return None
    kind = classify(title, text)
    if kind == "interview" and not any(term in title for term in ("面试", "面经", "实习", "求职", "offer", "Offer", "产品", "Agent")):
        return None
    signals = terms_in(f"{title} {text}", ROLE_TERMS + SKILL_TERMS)
    record = {
        "id": f"case-{hashlib.sha256((item['url'] + item.get('content_hash', '')).encode()).hexdigest()[:16]}",
        "type": kind,
        "title": title[:300],
        "source_url": item["url"],
        "source_date": item.get("retrieved_at", "")[:10],
        "signals": signals[:16],
        "source_excerpt": sentence_chunks(text),
        "source_hash": item.get("content_hash"),
        "verification": "pending_review",
        "confidence": 0.25 if kind == "reference" else 0.4,
    }
    if kind == "jd":
        record["requirements_detected"] = terms_in(text, SKILL_TERMS)
        record["role_detected"] = terms_in(f"{title} {text}", ROLE_TERMS)
    elif kind == "interview":
        record["questions_detected"] = [chunk for chunk in sentence_chunks(text, 12) if "？" in chunk or "?" in chunk][:8]
        record["gaps_detected"] = terms_in(text, SKILL_TERMS)
    elif kind == "career_path":
        record["stage_signals"] = [term for term in ("大一", "大二", "大三", "大四", "研一", "研二", "校招", "实习") if term in text]
        record["outcome_signals"] = [chunk for chunk in sentence_chunks(text, 12) if any(word in chunk.lower() for word in ("offer", "录用", "入职", "通过"))][:5]
    elif kind == "project_pattern":
        record["metrics_detected"] = [chunk for chunk in sentence_chunks(text, 12) if any(word in chunk for word in ("转化率", "留存", "耗时", "GMV", "指标", "用户"))][:6]
    return record


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default="data/public_cases.raw.jsonl")
    parser.add_argument("--output", default="data/cases.curated.jsonl")
    parser.add_argument("--pending", default="data/cases.pending.jsonl")
    args = parser.parse_args()
    source = Path(args.input)
    if not source.exists():
        raise SystemExit(f"missing input: {source}; run collect_public_cases.py first")
    records, pending, seen = [], [], set()
    for line in source.read_text(encoding="utf-8").splitlines():
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        record = curate(item)
        if not record or record["source_hash"] in seen:
            continue
        seen.add(record["source_hash"])
        # Automatic curation is allowed into the index, but provenance and
        # confidence remain visible so retrieval can down-rank weak sources.
        record["verification"] = "auto_curated"
        records.append(record)
        if record["confidence"] < 0.35:
            pending.append(record)
    for path, rows in ((Path(args.output), records), (Path(args.pending), pending)):
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open("w", encoding="utf-8") as stream:
            for row in rows:
                stream.write(json.dumps(row, ensure_ascii=False) + "\n")
    print(f"curated={len(records)} pending_review={len(pending)}")


if __name__ == "__main__":
    main()
