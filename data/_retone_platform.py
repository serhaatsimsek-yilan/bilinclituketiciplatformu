# -*- coding: utf-8 -*-
"""Retone article bodies: info-only, platform-first; no DIY legal path guidance."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

DISCLAIMER_NEW = (
    "<p><strong>Bu makale genel bilgi verir.</strong> "
    "Buradaki açıklamalar tek başınıza resmi başvuru veya hukuki süreç yürütmeniz için yol haritası sunmaz. "
    "Somut dosyanızın değerlendirilmesi ve sonraki adımların size iletilmesi için "
    "Bilinçli Tüketici Platformu'na başvurmanız gerekir; aşağıda konunun genel çerçevesi özetlenmektedir.</p>"
)

PLATFORM_NOTE = (
    "<p>Tek başınıza karşı tarafa veya resmi makamlara başvurmadan önce "
    "Bilinçli Tüketici Platformu'na kısa özet ve elinizdeki belgelerle başvurarak "
    "dosyanızın ön incelemesini talep etmeniz önerilir.</p>"
)

SECTION_UCUS = (
    "<h2>Evrakları saklarken</h2>"
    "<p>Bilet, boarding pass, gecikme veya iptal bildirimleri dosya incelemesinde kullanılır. "
    "Havayoluna doğrudan başvurmadan önce uçuş kaydınızın platformda ön değerlendirmesini "
    "yaptırmanız önerilir.</p>"
)

SECTION_DOCS = (
    "<h2>Belgelerinizi saklarken</h2>"
    "<p>Fatura, sözleşme, yazışma, fotoğraf ve tutanak gibi kayıtlar dosya incelemesinde işe yarar; "
    "hangi belgelerin gerekli olduğu her uyuşmazlıkta farklılaşır. "
    "Kayıtları bir arada tutmanız faydalıdır; karşı tarafa veya resmi makamlara tek başınıza "
    "gitmeden önce Bilinçli Tüketici Platformu'na ileterek dosyanızın incelenmesini talep edin.</p>"
)

SECTION_HAKEM_INFO = (
    "<h2>Resmi başvuru yolları hakkında</h2>"
    "<p>6502 sayılı Kanun, uyuşmazlık tutarına göre Tüketici Hakem Heyeti veya tüketici mahkemesi "
    "yolunu öngörebilir. Hangi yolun sizin dosyanızda gündeme geleceği; tutar, konu ve mevcut "
    "yazışmalara bağlıdır ve makale okuyarak tek başınıza belirlenemez. "
    "Platform incelemesinde dosyanız değerlendirilir; uygun görülürse sonraki adımlar size iletilir.</p>"
)

SECTION_PROCESS = (
    "<h2>Süreç hakkında genel bilgi</h2>"
    "<p>Cayma, iade veya şikâyet süreçlerinde yazılı kayıt ve delil önem taşır. "
    "Satıcı veya pazaryeri ile doğrudan yazışmadan önce durumunuzu platforma ileterek "
    "dosyanızın ön değerlendirmesini yaptırmanız önerilir; böylece hangi belgelerin "
    "toplanması gerektiği dosyanıza göre netleştirilir.</p>"
)

HAKEM_EXTRA = (
    "<p>Bu yazı Tüketici Hakem Heyeti ve mahkeme kavramlarını genel çerçevede açıklar; "
    "tek başınıza başvuru yapmanız için adım adım yol göstermez. "
    "Dosyanızın incelenmesi için platforma başvurmanız gerekir.</p>"
)

PHRASES = [
    (r"Tüketici Hakem Heyeti(?:'ne|'ye|'ni)?(?: veya Tüketici Mahkemesi(?:'ne|'ye|'ni)?)?(?: veya mahkeme)? yoluna gid(?:in|ilebilir)[^.]*\.", "Resmi başvuru yolları dosyanıza göre değişir; tek başınıza süreç yürütmeden önce Bilinçli Tüketici Platformu'na başvurun."),
    (r"[Hh]akem [Hh]eyeti(?: veya mahkeme)? yoluna gid(?:in|ilebilir)[^.]*\.", "Resmi başvuru yolları dosyanıza göre değişir; tek başınıza süreç yürütmeden önce Bilinçli Tüketici Platformu'na başvurun."),
    (r"Tüketici Hakem Heyeti'ne başvuru(?: veya dava yolu)? değerlendirilir[^.]*\.", "Anlaşmazlık sürerse dosyanız platformda incelenerek sonraki adımlar size iletilir."),
    (r"Anlaşmazlık devam ederse hakem heyeti veya mahkeme yoluna gidin[^.]*\.", "Anlaşmazlık sürerse Bilinçli Tüketici Platformu'na başvurarak dosyanızın incelenmesini talep edin."),
    (r"Red halinde delil dosyasıyla hakem heyeti veya mahkeme yoluna gidin[^.]*\.", "Ret halinde delillerinizi saklayın ve dosyanızın platformda incelenmesi için başvurun."),
    (r"Tüketici Hakem Heyeti veya mahkeme yolu uyuşmazlık tutarına göre değerlendirilir[^.]*\.", "Resmi başvuru yolları uyuşmazlık tutarına göre kanunda düzenlenmiştir; hangi yolun dosyanızda geçerli olduğu platform incelemesinde netleştirilir."),
    (r"Anlaşmazlık sağlanmazsa arabuluculuk veya dava yolu değerlendirilir[^.]*\.", "Uzlaşma sağlanmazsa dosyanızın platformda incelenmesi için başvurmanız önerilir."),
    (r"Başvuruda talep net olmalıdır[^.]*\.", "Talebin netleştirilmesi dosya incelemesinde yapılır."),
    (r"Uzlaşma sağlanmazsa arabuluculuk veya dava yolu değerlendirilir[^.]*\.", "Uzlaşma sağlanmazsa Bilinçli Tüketici Platformu'na başvurarak dosyanızın incelenmesini talep edin."),
    (r"Başvuru, yetkili Tüketici Hakem Heyetine dilekçe ve eklerle yapılır[^.]*\.", "Resmi başvurularda dilekçe ve ek belgeler kullanılır; hangi evrak setinin gerekli olduğu dosyanıza göre platform incelemesinde belirlenir."),
    (r"e-Devlet üzerinden[^.]*\.", "Elektronik başvuru kanalları mevzuatta düzenlenmiştir; dosyanıza uygun kanal platform incelemesinde netleştirilir."),
    (r"Yanlış heyete veya eksik evrakla yapılan başvuru[^.]*\.", "Eksik veya yanlış yönlendirilmiş başvurular süreci uzatabilir; evrak listesi platform incelemesinde paylaşılır."),
    (r"doğrudan tüketici mahkemesine başvurmak gerekir[^.]*\.", "Bazı uyuşmazlıklarda tüketici mahkemesi yolu kanunen öngörülebilir; dosyanızda hangi yolun geçerli olduğu platform incelemesinde netleştirilir."),
    (r"heyet yoluna başvurulabilir[^.]*\.", "Kanun, uyuşmazlık tutarına göre heyet yolunu öngörebilir; dosyanızda bu yolun geçerli olup olmadığı platform incelemesinde değerlendirilir."),
    (r"süre içinde mahkemeye gitmek[^.]*\.", "Karara karşı kanuni yollar mevzuatta düzenlenmiştir; somut dosyada ne yapılacağı platform incelemesinde netleştirilir."),
    (r"ilk değerlendirilecek seçenektir[^.]*\.", "Kanun çerçevesinde farklı yollar öngörülebilir; hangisinin dosyanızda geçerli olduğu platform incelemesinde belirlenir."),
    (r"Adım bir:[^.]*Adım altı:[^.]*\.", SECTION_PROCESS.replace("<h2>Süreç hakkında genel bilgi</h2>", "").strip()),
    (r"Adım bir:[^.]*Adım beş:[^.]*\.", SECTION_PROCESS.replace("<h2>Süreç hakkında genel bilgi</h2>", "").strip()),
    (r"Adım bir:[^.]*Adım dört:[^.]*\.", SECTION_PROCESS.replace("<h2>Süreç hakkında genel bilgi</h2>", "").strip()),
    (r"Havayoluna yazılı tazminat talebi gönderin[^.]*\.", "Havayolu yazışmalarınızı saklayın; tazminat sürecine geçmeden önce dosyanızın platformda ön değerlendirmesini yaptırın."),
    (r"karşı tarafa gitmeden önce[^.]*platformda ön değerlendirmesini yaptırmanız önerilir", "tek başınıza resmi başvuru yapmadan önce dosyanızın platformda incelenmesini talep etmeniz gerekir"),
    (r"e-Devlet[^.]*\.", "Elektronik başvuru kanalları mevzuatta düzenlenmiştir; dosyanızda hangi kanalın geçerli olduğu platform incelemesinde netleştirilir."),
    (r"Başvuru öncesinde Resmi Gazete[^.]*\.", "Parasal sınırlar mevzuatta düzenlenmiştir; tutar hesabı dosya incelemesinde yapılır."),
    (r"tutar dilekçe ile ekler arasında tutarlı olmalıdır[^.]*\.", "Tutar hesabı ve belge uyumu dosya incelemesinde kontrol edilir."),
    (r"önce heyet sonra mahkeme yoluna gidilebilecek[^.]*\.", "Heyet ve mahkeme yolları kanunda ayrı düzenlenmiştir; hangisinin dosyanızda geçerli olduğu platform incelemesinde belirlenir."),
    (r"hangi tutarda büyükşehir merkez heyetine gidileceğini belirler[^.]*\.", "Parasal sınırlar mevzuatta belirlenmiştir; dosyanıza uygun heyet düzeyi platform incelemesinde netleştirilir."),
    (r"Adım dört: Platform arabuluculuğu sonuç vermezse Tüketici Hakem Heyeti'ne[^.]*\.", "Pazaryeri kayıtları dosya incelemesinde değerlendirilir; sonraki adımlar platform tarafından iletilir."),
]


def replace_section(body: str, title_pattern: str, replacement: str) -> str:
    pat = re.compile(
        r"<h2>" + title_pattern + r"</h2>.*?(?=<h2>|$)",
        re.S | re.I,
    )
    return pat.sub(replacement, body)


def retone_body(body: str, fname: str) -> str:
    body = re.sub(
        r"<p><strong>Bu makale genel bilgi verir\.</strong>[^<]*</p>",
        DISCLAIMER_NEW,
        body,
        count=1,
    )

    if fname.startswith("makale-hakem") or fname in {
        "makale-tuketici-mahkemesi.html",
        "makale-once-satici.html",
        "makale-basvuru-red.html",
        "makale-karar-uygulama.html",
        "makale-hakem-avukat.html",
        "makale-uyusmazlik-tutari.html",
    }:
        if HAKEM_EXTRA not in body:
            body = body.replace(DISCLAIMER_NEW, DISCLAIMER_NEW + HAKEM_EXTRA, 1)

    ucus = {
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
    practical = SECTION_UCUS if fname in ucus else SECTION_DOCS

    body = replace_section(body, r"Pratik adımlar", practical)
    body = replace_section(body, r"Somut dosyada izlenecek yol", SECTION_DOCS)
    body = replace_section(body, r"Tüketici Hakem Heyeti başvurusu", SECTION_HAKEM_INFO)
    body = replace_section(body, r"Adım adım[^<]*", SECTION_PROCESS)

    pad = (
        "<p>Kanuni süreler, belge düzeni ve karşı taraf yazışmaları her dosyada farklılaşır. "
        "Bu makale yalnızca genel çerçeve sunar; tek başınıza resmi başvuru yapmanız için "
        "adım adım rehber niteliği taşımaz. Somut dosyanız için Bilinçli Tüketici Platformu'na başvurun.</p>"
    )
    if len(re.sub(r"<[^>]+>", " ", body).split()) < 500:
        body = body.rstrip() + pad

    for old, new in PHRASES:
        body = re.sub(old, new, body, flags=re.I)

    # Soften remaining imperative legal-path sentences in paragraphs
    body = re.sub(
        r"(?<=<p>)([^<]*?\b(?:dava aç|itiraz dilekçesi|dilekçe hazırl|heyete gid|mahkemeye gid|e-Devlet(?:\'ten| üzerinden) başvur)[^<]*?)(?=</p>)",
        "Resmi başvuru adımları dosyanıza göre değişir; tek başınıza süreç yürütmeden Bilinçli Tüketici Platformu'na başvurmanız gerekir.",
        body,
        flags=re.I,
    )

    if "Platformu'na başvur" not in body and "platformda" not in body.lower():
        body = body.rstrip() + PLATFORM_NOTE

    while body.count(SECTION_DOCS) > 1:
        body = body.replace(SECTION_DOCS, "", 1)
    while body.count(SECTION_UCUS) > 1:
        body = body.replace(SECTION_UCUS, "", 1)

    return body


def main() -> None:
    for path in sorted(DATA.glob("bodies_*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        updated = {}
        for fname, body in data.items():
            updated[fname] = retone_body(body, fname)
        path.write_text(
            json.dumps(updated, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("retone", path.name, len(updated))


if __name__ == "__main__":
    main()
