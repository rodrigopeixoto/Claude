#!/usr/bin/env python3
"""Apple App Store reviews scraper.

Fetches reviews (content, rating, date) for a given App Store app using the
public JSON endpoint that apps.apple.com itself uses to render reviews.
Based on the approach from https://github.com/glennfang/apple-app-reviews-scraper
(fetch reviews via Apple's catalog API, paginate with `offset`, back off on
HTTP 429 "API capacity exceeded" responses).

Usage:
    python3 scrape.py --url "https://apps.apple.com/br/app/vivo-fatura-suporte-e-mais/id475915064" --count 300
    python3 scrape.py --country br --app-id 475915064 --count 300 --out reviews.csv
"""
import argparse
import csv
import json
import random
import re
import sys
import time
import urllib.error
import urllib.request

BASE_URL = "https://apps.apple.com/api/apps/v1/catalog/{country}/apps/{app_id}/reviews"

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1",
]

APP_URL_RE = re.compile(r"apps\.apple\.com/(?P<country>[a-z]{2})/app/[^/]+/id(?P<app_id>\d+)")


def parse_app_url(url):
    m = APP_URL_RE.search(url)
    if not m:
        raise ValueError(f"Could not parse country/app id from URL: {url}")
    return m.group("country"), m.group("app_id")


def fetch_page(country, app_id, lang, offset, limit, max_retries=6):
    url = f"{BASE_URL.format(country=country, app_id=app_id)}?l={lang}&offset={offset}&limit={limit}&platform=web"
    delay = 2.0
    for attempt in range(1, max_retries + 1):
        req = urllib.request.Request(
            url,
            headers={"User-Agent": random.choice(USER_AGENTS), "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")
            if e.code == 429 or "API capacity" in body:
                sys.stderr.write(f"[offset={offset}] rate limited (attempt {attempt}), backing off {delay:.1f}s\n")
                time.sleep(delay + random.uniform(0, 1))
                delay = min(delay * 1.8, 30)
                continue
            if e.code == 404:
                return None
            raise
        except Exception as e:
            sys.stderr.write(f"[offset={offset}] error {e} (attempt {attempt}), retrying in {delay:.1f}s\n")
            time.sleep(delay)
            delay = min(delay * 1.8, 30)
    raise RuntimeError(f"Failed to fetch offset={offset} after {max_retries} retries")


def scrape_reviews(country, app_id, lang="pt-BR", target=300, limit=20):
    all_reviews = []
    seen_ids = set()
    offset = 0

    while len(all_reviews) < target:
        page = fetch_page(country, app_id, lang, offset, limit)
        if not page or not page.get("data"):
            sys.stderr.write(f"No more data at offset={offset}, stopping.\n")
            break

        for item in page["data"]:
            rid = item.get("id")
            if rid in seen_ids:
                continue
            seen_ids.add(rid)
            attrs = item.get("attributes", {})
            all_reviews.append({
                "id": rid,
                "date": attrs.get("date"),
                "rating": attrs.get("rating"),
                "title": attrs.get("title"),
                "review": attrs.get("review"),
                "userName": attrs.get("userName"),
                "isEdited": attrs.get("isEdited"),
            })

        sys.stderr.write(f"offset={offset} -> total collected: {len(all_reviews)}\n")

        if not page.get("next"):
            sys.stderr.write("No 'next' link, reached end of available reviews.\n")
            break

        offset += limit
        time.sleep(0.6 + random.uniform(0, 0.6))

    return all_reviews[:target]


def write_json(reviews, path):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(reviews, f, ensure_ascii=False, indent=2)


def write_csv(reviews, path):
    fields = ["id", "date", "rating", "title", "review", "userName", "isEdited"]
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        for r in reviews:
            writer.writerow(r)


def main():
    parser = argparse.ArgumentParser(description="Scrape Apple App Store reviews (content + date).")
    parser.add_argument("--url", help="App Store app URL, e.g. https://apps.apple.com/br/app/name/id123")
    parser.add_argument("--country", help="Storefront country code, e.g. br (ignored if --url is set)")
    parser.add_argument("--app-id", help="Numeric app id (ignored if --url is set)")
    parser.add_argument("--lang", default="pt-BR", help="Language code for review text (default: pt-BR)")
    parser.add_argument("--count", type=int, default=300, help="Number of reviews to fetch (default: 300)")
    parser.add_argument("--out", default="reviews.csv", help="Output file path (.csv or .json)")
    args = parser.parse_args()

    if args.url:
        country, app_id = parse_app_url(args.url)
    elif args.country and args.app_id:
        country, app_id = args.country, args.app_id
    else:
        parser.error("Provide either --url or both --country and --app-id")

    reviews = scrape_reviews(country, app_id, lang=args.lang, target=args.count)

    if args.out.endswith(".json"):
        write_json(reviews, args.out)
    else:
        write_csv(reviews, args.out)

    sys.stderr.write(f"DONE. Wrote {len(reviews)} reviews to {args.out}\n")


if __name__ == "__main__":
    main()
