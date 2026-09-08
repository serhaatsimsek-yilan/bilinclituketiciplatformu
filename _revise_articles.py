# -*- coding: utf-8 -*-
"""Merge category JSON bodies into makale-*.html files."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"

UCUS_FILES = {
    "makale-ucus-3-saat.html",
    "makale-ucus-iptal.html",
    "makale-ucaga-alinmama.html",
    "makale-bagaj.html",
    "makale-aktarma.html",
    "makale-evrak.html",
    "makale-shy-yolcu.html",
    "makale-havayolu-gerekce.html",
    "makale-ucus-masraf.html",
    "makale-kupon-teklifi.html",
}

CTA_UCUS = """
      <h2>Platforma başvuru</h2>
      <p>Yukarıdaki bilgiler genel çerçeveyi açıklar; tek başınıza havayoluna başvuru veya resmi süreç yürütmeniz için yol göstermez. Uçuş kaydınız incelenmeden kesin tazminat tutarı veya hak varlığı ifade edilemez. Bilinçli Tüketici Platformu'nda ücretsiz uçuş sorgulama yaparak dosyanızın ön incelemesini talep edin.</p>
      <p>Uçuş numarası, tarih ve kısa özet yeterlidir; uygun görülen kayıtlarda evrak listesi infobilinclituketiciplatformu@gmail.com üzerinden paylaşılır.</p>
      <div class="article-cta">
        <h2>Uçuş kaydınızı platformda sorgulayın</h2>
        <p>Form birkaç dakika sürer. Havayoluna veya resmi kanallara tek başınıza gitmeden önce dosyanızın platformda incelenmesini talep edin.</p>
        <a class="nav-cta" href="ucus-tazminati.html">Uçuşumu sorgula</a>
      </div>"""

CTA_DEFAULT = """
      <h2>Platforma başvuru</h2>
      <p>Yukarıdaki bilgiler genel çerçeveyi açıklar; tek başınıza karşı tarafa veya resmi makamlara başvuru yapmanız için adım adım yol göstermez. Sözleşme, fatura ve yazışmalar olmadan kişisel dosyanız için net sonuç verilemez. Bilinçli Tüketici Platformu'na kısa özet ve mevcut belgelerinizle başvurarak dosyanızın incelenmesini talep edin.</p>
      <p>İletişim formu veya infobilinclituketiciplatformu@gmail.com adresi üzerinden uyuşmazlığın özeti, tarihleri ve elinizdeki evrakları iletmeniz yeterlidir; uygun görülen başvurularda sonraki adım size iletilir.</p>
      <div class="article-cta">
        <h2>Platforma başvurun</h2>
        <p>Durumunuzu kısaca yazın. Hakem heyeti, mahkeme veya satıcıya tek başınıza gitmeden önce dosyanızın platformda incelenmesini talep edin.</p>
        <a class="nav-cta" href="iletisim.html">Platforma başvur</a>
      </div>"""


def word_count(html: str) -> int:
    text = re.sub(r"<[^>]+>", " ", html)
    return len(text.split())


def load_bodies() -> dict:
    bodies = {}
    for path in sorted(DATA.glob("bodies_*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        bodies.update(data)
    return bodies


def apply_body(filename: str, body: str) -> None:
    path = ROOT / filename
    html = path.read_text(encoding="utf-8")
    cta = CTA_UCUS if filename in UCUS_FILES else CTA_DEFAULT
    full = f"{body.rstrip()}\n{cta}\n"
    new_html, n = re.subn(
        r"(<section class=\"card article-content\">)(.*?)(</section>)",
        lambda m: m.group(1) + "\n" + full + "    " + m.group(3),
        html,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"content block not found: {filename}")
    path.write_text(new_html, encoding="utf-8")


def main() -> None:
    bodies = load_bodies()
    if not bodies:
        raise SystemExit("no bodies loaded from data/bodies_*.json")

    expected = {p.name for p in ROOT.glob("makale-*.html")}
    missing = expected - set(bodies)
    if missing:
        raise SystemExit(f"missing bodies for: {sorted(missing)}")

    short = []
    for name, body in sorted(bodies.items()):
        apply_body(name, body)
        wc = word_count(body)
        print(f"{name}: {wc} kelime")
        if wc < 500:
            short.append(f"{name} ({wc})")

    if short:
        print("warning — below 500 words:", ", ".join(short))
    print(f"ok — {len(bodies)} makale güncellendi")


if __name__ == "__main__":
    main()
