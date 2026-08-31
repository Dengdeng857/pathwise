#!/usr/bin/env python3
"""Collect public career/product pages for later RAG curation.

This collector is deliberately conservative: it follows robots.txt, stays on
the supplied domains, skips non-HTML/login pages, rate-limits requests, and
stores raw text plus provenance. It does not bypass access controls.
"""
import argparse
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
import urllib.robotparser
from collections import deque
from html.parser import HTMLParser
from pathlib import Path


class TextExtractor(HTMLParser):
    SKIP = {"script", "style", "noscript", "svg", "header", "footer", "nav"}

    def __init__(self):
        super().__init__()
        self.title = []
        self.parts = []
        self.skip_depth = 0
        self.in_title = False

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag == "title":
            self.in_title = True
        if tag in self.SKIP:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        if tag in self.SKIP and self.skip_depth:
            self.skip_depth -= 1

    def handle_data(self, data):
        value = re.sub(r"\s+", " ", data).strip()
        if not value:
            return
        if self.in_title:
            self.title.append(value)
        if not self.skip_depth:
            self.parts.append(value)


def normalize_url(url):
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", "", ""))


def allowed(url, seeds):
    host = urllib.parse.urlsplit(url).netloc.lower()
    return any(urllib.parse.urlsplit(seed).netloc.lower() == host for seed in seeds)


def candidate_url(url):
    """Reject obvious shells before paying the cost of fetching them."""
    path = urllib.parse.urlsplit(url).path.lower()
    blocked = ("/practice/", "/exam/", "/users/", "/courses", "/app", "/html/", "/simple/", "/jump", "/home/", "/activity/")
    if any(part in path for part in blocked):
        return False
    # Detail-like paths carry substantially more evidence than site indexes.
    return path in {"/", "/campus/"} or any(part in path for part in ("/discuss/", "/feed/", "/creation/", "/position/", "/campus/"))


def fetch(url, timeout):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "PathwisePublicCaseCollector/1.0 (+local research tool)"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        content_type = response.headers.get("Content-Type", "")
        if "text/html" not in content_type.lower():
            return None, content_type
        raw = response.read(2_000_000)
        charset = response.headers.get_content_charset() or "utf-8"
        return raw.decode(charset, errors="replace"), content_type


def extract(url, html):
    parser = TextExtractor()
    parser.feed(html)
    text = re.sub(r"\s+", " ", " ".join(parser.parts)).strip()
    if len(text) < 240:
        return None
    # Keep enough context for later chunking, while preventing one page from
    # dominating the retrieval index.
    text = text[:30_000]
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]
    return {
        "id": f"public-{digest}",
        "type": "raw_public_page",
        "title": " ".join(parser.title).strip()[:300] or url,
        "url": url,
        "text": text,
        "content_hash": digest,
        "retrieved_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "verification": "raw_needs_curation",
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("urls", nargs="+", help="Public pages or sitemap URLs")
    parser.add_argument("--out", default="data/public_cases.raw.jsonl")
    parser.add_argument("--max-pages", type=int, default=80)
    parser.add_argument("--delay", type=float, default=1.2)
    parser.add_argument("--timeout", type=float, default=20)
    args = parser.parse_args()
    seeds = [normalize_url(u) for u in args.urls]
    queue = deque(seeds)
    seen, hashes = set(), set()
    output = Path(args.out)
    output.parent.mkdir(parents=True, exist_ok=True)
    robots = {}
    collected = 0

    with output.open("a", encoding="utf-8") as stream:
        while queue and collected < args.max_pages:
            url = normalize_url(queue.popleft())
            if url in seen or not allowed(url, seeds) or not candidate_url(url):
                continue
            seen.add(url)
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme not in {"http", "https"}:
                continue
            root = f"{parsed.scheme}://{parsed.netloc}"
            if root not in robots:
                rp = urllib.robotparser.RobotFileParser(f"{root}/robots.txt")
                try:
                    rp.read()
                except Exception:
                    # An unavailable robots file is not treated as permission
                    # to crawl aggressively; skip the domain instead.
                    rp = None
                robots[root] = rp
            if robots[root] is None or not robots[root].can_fetch("PathwisePublicCaseCollector", url):
                continue
            try:
                html, _ = fetch(url, args.timeout)
            except Exception as error:
                print(f"skip {url}: {error}", file=sys.stderr)
                continue
            if not html:
                continue
            item = extract(url, html)
            if item and item["content_hash"] not in hashes:
                stream.write(json.dumps(item, ensure_ascii=False) + "\n")
                stream.flush()
                hashes.add(item["content_hash"])
                collected += 1
                print(f"collected {collected}: {url}")
            for href in re.findall(r"<a[^>]+href=[\"']([^\"']+)", html, flags=re.I):
                child = normalize_url(urllib.parse.urljoin(url, href))
                if allowed(child, seeds) and candidate_url(child) and child not in seen and len(queue) < args.max_pages * 4:
                    queue.append(child)
            time.sleep(max(0, args.delay))
    print(f"saved {collected} pages to {output}")


if __name__ == "__main__":
    main()
