# -*- coding: utf-8 -*-
"""Add airline keywords to flight articles (HTML + bodies_ucus.json)."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

UCUS_FILES = [
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
]

AIRLINE_INTRO = {
    "makale-ucus-3-saat.html": (
        "<h2>Pegasus, THY, SunExpress ve diğer havayollarında gecikme</h2>",
        "<p>Türkiye'den kalkış yapan Pegasus (PC), Türk Hava Yolları (THY), SunExpress (XQ), AJet (AnadoluJet), Corendon Airlines, Freebird Airlines ve diğer taşıyıcı uçuşlarında da SHY-YOLCU hükümleri uygulanır. "
        "Pegasus gecikme tazminatı, THY rötar tazminatı veya SunExpress iptal tazminatı arayan yolcular için değerlendirme kriteri uçuş kaydıdır; havayolu markası tek başına hak doğurmaz veya engellemez. "
        "Uçuş numarası (ör. PC, TK, XQ kodlu seferler) resmî kayıtla birlikte incelenmelidir.</p>",
    ),
    "makale-ucus-iptal.html": (
        "<h2>Pegasus, THY ve SunExpress iptal uçuşları</h2>",
        "<p>Pegasus iptal, Türk Hava Yolları uçuş iptali veya SunExpress sefer iptali hâllerinde yolcu hakları SHY-YOLCU çerçevesinde değerlendirilir. "
        "AJet, Corendon, Freebird ve charter kod paylaşımlı uçuşlarda sorumlu taşıyıcı bilet ve operasyon kaydından belirlenir. "
        "Her havayolunun müşteri hizmetleri ve online tazminat formu farklı olsa da yasal çerçeve aynıdır; ret gerekçesi yazılı incelenmelidir.</p>",
    ),
    "makale-ucaga-alinmama.html": (
        "<h2>THY, Pegasus ve SunExpress uçağa alınmama</h2>",
        "<p>Türk Hava Yolları overbooking, Pegasus kapıda alınmama veya SunExpress dolu uçak uygulamalarında denied boarding hükümleri geçerlidir. "
        "AJet, Corendon Airlines ve diğer taşıyıcılarda da bilet ve check-in kaydı olan yolcu için aynı yönetmelik maddeleri tartışılır. "
        "Kapıda imzalanan feragat formu, hangi havayolunda olursa olsun dikkatle okunmalıdır.</p>",
    ),
    "makale-bagaj.html": (
        "<h2>Pegasus, THY, SunExpress bagaj gecikmesi ve kaybı</h2>",
        "<p>Pegasus bagaj gecikmesi, THY kayıp bagaj veya SunExpress hasarlı bagaj şikâyetlerinde PIR tutanağı ve bagaj fişi esastır. "
        "SunExpress, Corendon, Freebird ve yurt dışı aktarmalı uçuşlarda (Lufthansa, Emirates, Qatar Airways bağlantılı biletler) Montreal Sözleşmesi ile SHY-YOLCU birlikte değerlendirilebilir. "
        "Taşıyıcı markası değil, bagaj kaydı ve uçuş bacağı belirleyicidir.</p>",
    ),
    "makale-aktarma.html": (
        "<h2>THY, Pegasus ve SunExpress aktarmalı uçuşlar</h2>",
        "<p>Türk Hava Yolları aktarma, Pegasus bağlantılı bilet veya SunExpress aktarmalı seferlerde tek PNR altındaki rezervasyonlar farklı değerlendirilir. "
        "İstanbul Havalimanı, Sabiha Gökçen, Antalya ve diğer hub'larda THY–Pegasus, SunExpress–AJet veya yabancı taşıyıcı (KLM, Air France, British Airways) kombinasyonlarında bağlantı kaçırma kayıtları ayrı tutulmalıdır.</p>",
    ),
    "makale-evrak.html": (
        "<h2>Pegasus, THY, SunExpress tazminat evrakları</h2>",
        "<p>Pegasus tazminat başvurusu, Türk Hava Yolları tazminat formu veya SunExpress şikâyet kaydı farklı kanallardan iletilse de temel evrak seti aynıdır: bilet, boarding pass, gecikme/iptal bildirimi. "
        "AJet, Corendon ve diğer havayolu uygulamalarından alınan e-posta onayları dosyaya eklenmeli; uçuş kodu (TK, PC, XQ vb.) her belgede görünür olmalıdır.</p>",
    ),
    "makale-shy-yolcu.html": (
        "<h2>SHY-YOLCU ve Türk havayolları</h2>",
        "<p>SHY-YOLCU; Pegasus, Türk Hava Yolları, SunExpress, AJet, Corendon Airlines, Freebird Airlines ve Türkiye'den kalkış yapan tüm tarifeli uçuşlarda uygulanır. "
        "THY dış hat, Pegasus iç hat veya SunExpress charter ayrımı yapılmaksızın yolcu hakları yönetmelikte düzenlenmiştir. "
        "Yabancı havayolu (Emirates, Lufthansa, Ryanair) uçuşlarında kalkış/varış noktasına göre EC 261/2004 ile birlikte değerlendirme gündeme gelebilir.</p>",
    ),
    "makale-havayolu-gerekce.html": (
        "<h2>Pegasus, THY, SunExpress olağanüstü hal savunması</h2>",
        "<p>Pegasus teknik arıza, THY hava muhalefeti veya SunExpress operasyonel gerekçe gibi ret cevapları somut delille test edilmelidir. "
        "AJet, Corendon ve diğer taşıyıcılarda aynı gün benzer rotada uçuş yapılıp yapılmadığı savunmayı zayıflatır. "
        "Havayolu adı değiştirmez; ispat yükü taşıyıcıdadır.</p>",
    ),
    "makale-ucus-masraf.html": (
        "<h2>Pegasus, THY, SunExpress rötar masrafları</h2>",
        "<p>Pegasus gecikme oteli, THY yemek kuponu veya SunExpress transfer yönlendirmesi Madde 7 bakım yükümlülüğünün parçası olabilir; nakdi tazminattan ayrıdır. "
        "Corendon, Freebird ve diğer taşıyıcılarda da makul otel, yemek ve ulaşım fişleri talep konusu yapılabilir. "
        "Havayolunun resmî formu (Pegasus, THY Müşteri İlişkileri, SunExpress destek hattı) üzerinden yazılı talep kaydı oluşturulmalıdır.</p>",
    ),
    "makale-kupon-teklifi.html": (
        "<h2>Pegasus, THY, SunExpress kupon ve tazminat</h2>",
        "<p>Pegasus indirim kuponu, Türk Hava Yolları mil teklifi veya SunExpress gelecek uçuş kredisi nakdi tazminatın yerine geçmeyebilir. "
        "AJet, Corendon Airlines ve diğer havayollarının kapı önü feragat formları aynı hukuki ilkelere tabidir. "
        "Kupon kabulü ile THY, Pegasus veya SunExpress tazminat hakkından feragat edilip edilmediği imzalanan metne göre ayrı okunur.</p>",
    ),
}

META_AIRLINE = "Pegasus, THY, SunExpress, AJet"


def inject_body(html: str, fname: str) -> str:
    if "Pegasus" in html and "Türk Hava Yolları" in html:
        return html
    h2, p = AIRLINE_INTRO[fname]
    block = h2 + p
    marker = "</p><p><strong>Bu makale genel bilgi verir.</strong>"
    alt = "<p><strong>Bu makale genel bilgi verir.</strong>"
    if marker in html:
        return html.replace(marker, "</p>" + block + "<p><strong>Bu makale genel bilgi verir.</strong>", 1)
    if alt in html:
        return html.replace(alt, block + alt, 1)
    m = re.search(r"(<section class=\"card article-content\">)", html)
    if m:
        return html[: m.end()] + block + html[m.end() :]
    return html


def update_meta(html: str, fname: str) -> str:
    if "Pegasus" in (re.search(r'name="description" content="([^"]*)"', html) or [""])[0]:
        return html
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    if not m:
        return html
    desc = m.group(1).rstrip(".")
    if "Pegasus" not in desc:
        desc = f"{desc} {META_AIRLINE}."
        if len(desc) > 158:
            desc = desc[:155].rsplit(" ", 1)[0] + "…"
    html = re.sub(r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{desc}"', html, 1)
    html = re.sub(r'<meta property="og:description" content="[^"]*"', f'<meta property="og:description" content="{desc}"', html, 1)

    def schema_repl(match):
        data = json.loads(match.group(1))
        data["description"] = desc
        return '<script type="application/ld+json">\n  ' + json.dumps(data, ensure_ascii=False) + "\n  </script>"

    html = re.sub(
        r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
        schema_repl,
        html,
        count=1,
        flags=re.S,
    )
    return html


def main() -> None:
    json_path = ROOT / "data" / "bodies_ucus.json"
    bodies = {}
    if json_path.exists():
        bodies = json.loads(json_path.read_text(encoding="utf-8"))

    for fname in UCUS_FILES:
        path = ROOT / fname
        html = path.read_text(encoding="utf-8")
        html = inject_body(html, fname)
        html = update_meta(html, fname)
        path.write_text(html, encoding="utf-8")
        print(f"updated {fname}")

        if fname in bodies:
            m = re.search(
                r'<section class="card article-content">(.*?)(?=<h2>Platforma başvuru</h2>)',
                html,
                re.S,
            )
            if m:
                bodies[fname] = m.group(1).strip()

    if bodies:
        json_path.write_text(json.dumps(bodies, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"synced {json_path.name}")


if __name__ == "__main__":
    main()
