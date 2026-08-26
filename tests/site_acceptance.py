import json
import re
import unittest
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://redbananatechsolutions.in"


class Document(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.source = source
        self.tags = []
        self.ids = set()
        self.links = []
        self.json_ld = []
        self._json_buffer = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        self.tags.append((tag, attrs))
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "script" and attrs.get("type") == "application/ld+json":
            self._json_buffer = []

    def handle_data(self, data):
        if self._json_buffer is not None:
            self._json_buffer.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._json_buffer is not None:
            self.json_ld.append("".join(self._json_buffer))
            self._json_buffer = None

    def count(self, tag, **attrs):
        return sum(t == tag and all(a.get(k) == v for k, v in attrs.items()) for t, a in self.tags)

    def has(self, tag, **attrs):
        return self.count(tag, **attrs) > 0


class SiteAcceptance(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pages = {}
        for path in sorted(ROOT.glob("*.html")):
            source = path.read_text(encoding="utf-8")
            doc = Document(source)
            doc.feed(source)
            cls.pages[path.name] = doc

    def test_expected_public_pages_exist(self):
        self.assertEqual(set(self.pages), {"index.html", "capabilities.html", "work.html", "about.html", "contact.html", "privacy.html", "404.html"})

    def test_every_page_has_core_accessibility_and_seo(self):
        for name, doc in self.pages.items():
            with self.subTest(page=name):
                self.assertEqual(doc.count("html", lang="en"), 1)
                self.assertEqual(doc.count("h1"), 1)
                self.assertEqual(doc.count("main", id="main-content"), 1)
                self.assertTrue(doc.has("a", href="#main-content", **{"class": "skip-link"}))
                self.assertTrue(doc.has("meta", name="description"))
                self.assertTrue(doc.has("meta", property="og:title"))
                self.assertTrue(doc.has("meta", property="og:description"))
                self.assertTrue(doc.has("meta", name="twitter:card"))
                expected = DOMAIN + ("/" if name == "index.html" else "/" + name)
                self.assertTrue(doc.has("link", rel="canonical", href=expected))
                self.assertTrue(doc.has("meta", property="og:url", content=expected))
                self.assertTrue(doc.has("script", src="/privacy-analytics.js", defer=None))
                self.assertIn("privacy.html", doc.links)

    def test_current_navigation_is_programmatically_exposed(self):
        for name in ("capabilities.html", "work.html", "about.html", "contact.html"):
            with self.subTest(page=name):
                self.assertTrue(self.pages[name].has("a", href=name, **{"aria-current": "page"}))

    def test_internal_links_and_fragments_resolve(self):
        for source_name, doc in self.pages.items():
            for href in doc.links:
                parsed = urlsplit(href)
                if parsed.scheme or href.startswith("//"):
                    continue
                target_name = parsed.path or source_name
                if target_name == "/":
                    target_name = "index.html"
                target_name = target_name.lstrip("/")
                with self.subTest(source=source_name, href=href):
                    self.assertIn(target_name, self.pages)
                    if parsed.fragment:
                        self.assertIn(parsed.fragment, self.pages[target_name].ids)

    def test_work_table_has_accessible_structure(self):
        doc = self.pages["work.html"]
        self.assertEqual(doc.count("caption"), 1)
        self.assertEqual(doc.count("thead"), 1)
        self.assertEqual(doc.count("tbody"), 1)
        self.assertEqual(doc.count("th", scope="col"), 3)

    def test_schema_and_crawl_artifacts(self):
        schemas = [json.loads(value) for value in self.pages["index.html"].json_ld]
        self.assertTrue(any(item.get("@type") == "Organization" for item in schemas))
        sitemap = ET.parse(ROOT / "sitemap.xml").getroot()
        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        urls = {node.text for node in sitemap.findall(f"{ns}url/{ns}loc")}
        expected = {DOMAIN + ("/" if name == "index.html" else "/" + name) for name in self.pages if name != "404.html"}
        self.assertEqual(urls, expected)
        robots = (ROOT / "robots.txt").read_text(encoding="utf-8")
        self.assertIn("Allow: /", robots)
        self.assertIn(f"Sitemap: {DOMAIN}/sitemap.xml", robots)

    def test_custom_404_is_not_indexed(self):
        self.assertTrue(self.pages["404.html"].has("meta", name="robots", content="noindex"))

    def test_production_urls_are_https_and_analytics_is_live(self):
        for path in list(ROOT.glob("*.html")) + [ROOT / "robots.txt", ROOT / "sitemap.xml"]:
            with self.subTest(path=path.name):
                self.assertNotRegex(path.read_text(encoding="utf-8"), r"http://redbananatechsolutions\.in")
        analytics = (ROOT / "privacy-analytics.js").read_text(encoding="utf-8")
        self.assertIn("https://cultre-website-analytics.hh-web.workers.dev", analytics)
        self.assertNotIn("REPLACE_WITH_DEPLOYED_COLLECTOR_URL", analytics)
        self.assertRegex(analytics, r"if \(!/\^https:")
        self.assertNotIn("document.cookie", analytics)
        privacy = (ROOT / "privacy.html").read_text(encoding="utf-8")
        self.assertNotIn("collector is not active", privacy)

    def test_mobile_and_reduced_motion_guards_remain(self):
        css = (ROOT / "styles.css").read_text(encoding="utf-8")
        for token in ("@media(max-width:620px)", "min-height:44px", "overflow-wrap:anywhere", "prefers-reduced-motion:reduce", "scroll-behavior:auto"):
            with self.subTest(token=token):
                self.assertIn(token, css)
        for name, doc in self.pages.items():
            if name not in ("privacy.html", "404.html"):
                self.assertIn("'IntersectionObserver' in window", doc.source)


if __name__ == "__main__":
    unittest.main()
