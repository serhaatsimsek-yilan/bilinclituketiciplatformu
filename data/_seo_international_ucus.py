# -*- coding: utf-8 -*-
"""International flight SEO + full airline keywords for uçuş articles."""
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

DISCLAIMER = (
    "<p><strong>Bu makale genel bilgi verir.</strong> "
    "Kişisel dosyanızın değerlendirilmesi ve size dönüş yapılması için "
    "Bilinçli Tüketici Platformu'na başvurmanız yeterlidir; "
    "aşağıda konunun genel çerçevesi özetlenmektedir.</p>"
)

AIRLINES_LIST = (
    "Türk Hava Yolları (THY), Pegasus, SunExpress, AJet, Corendon Airlines, Freebird Airlines, "
    "Tailwind Airlines, Lufthansa, Emirates, Qatar Airways, British Airways, Air France, KLM, "
    "Ryanair, easyJet, Wizz Air, Austrian Airlines, Swiss, Aegean Airlines, Etihad Airways, "
    "Flydubai, Saudia, ITA Airways, Iberia, Finnair, LOT Polish Airlines, TAROM, Air Arabia, "
    "Transavia, Gulf Air, MEA, Norwegian ve diğer taşıyıcılar"
)

KEYWORDS = (
    "uçuş tazminatı, dış hat uçuş, yurt dışı uçuş, Türkiye uçuş tazminatı, SHY-YOLCU, "
    "THY tazminat, Pegasus tazminat, SunExpress tazminat, AJet, Lufthansa tazminat, "
    "Emirates gecikme, Qatar Airways iptal, British Airways, Air France, KLM, Ryanair, "
    "easyJet, Wizz Air, İstanbul Havalimanı, Sabiha Gökçen, EC 261, yolcu hakları"
)

INTRO = {
    "makale-ucus-3-saat.html": (
        "<h2>Yurt dışı – Türkiye uçuşlarında 3 saat gecikme</h2>"
        "<p>Almanya, İngiltere, Hollanda, Fransa, İtalya, İspanya, ABD, Körfez ülkeleri ve diğer "
        "destinasyonlardan Türkiye'ye veya Türkiye'den kalkış yapan dış hat uçuşlarında varış "
        "gecikmesi SHY-YOLCU ile değerlendirilir. Avrupa'dan kalkışlı uçuşlarda EC 261/2004 "
        "hükümleri de gündeme gelebilir. İstanbul Havalimanı, Sabiha Gökçen ve Antalya "
        "aktarmalı rotalarda nihai varış gecikmesi esas alınır.</p>"
        f"<h2>{AIRLINES_LIST.split(',')[0]} ve tüm havayollarında gecikme tazminatı</h2>"
        f"<p>{AIRLINES_LIST} uçuşlarında gecikme tazminatı aranırken uçuş kaydı, boarding pass "
        "ve resmî varış saati belirleyicidir. THY dış hat, Pegasus Avrupa seferi, SunExpress "
        "tatil rotası veya Lufthansa, Emirates, Qatar Airways aktarmalı bilette değerlendirme "
        "uçuş verisine dayanır; havayolu adı tek başına hak doğurmaz veya engellemez.</p>"
    ),
    "makale-ucus-iptal.html": (
        "<h2>Yurt dışından veya yurt dışına iptal edilen uçuşlar</h2>"
        "<p>Türkiye'den Avrupa, Orta Doğu, Amerika veya Uzak Doğu'ya; yabancı ülkelerden "
        "İstanbul, Ankara, İzmir ve diğer Türk havalimanlarına yapılan seferler iptal edildiğinde "
        "SHY-YOLCU bildirim süreleri ve alternatif uçuş yükümlülükleri uygulanır. AB kalkışlı "
        "uçuşlarda EC 261 iptal tazminatı ayrıca tartışılabilir.</p>"
        "<h2>Pegasus, THY, SunExpress ve uluslararası taşıyıcı iptalleri</h2>"
        f"<p>{AIRLINES_LIST} için iptal bildirimi, alternatif sefer ve iade süreçleri farklı "
        "kanallardan yürütülse de yasal çerçeve aynı kalır. THY–Lufthansa, Pegasus–Ryanair veya "
        "Emirates aktarmalı tek PNR bileti ile ayrı bilet kombinasyonları dosyada ayrı okunur.</p>"
    ),
    "makale-ucaga-alinmama.html": (
        "<h2>Dış hat uçuşlarda uçağa alınmama (denied boarding)</h2>"
        "<p>Avrupa dönüşü, tatil sezonu yoğunluğu ve hub aktarmalarında overbooking sık görülür. "
        "Türkiye kalkışlı veya Türkiye varışlı uluslararası uçuşlarda bilet ve check-in kaydı "
        "olan yolcu için SHY-YOLCU kabul edilmeme hükümleri geçerlidir.</p>"
        "<h2>THY, Pegasus, SunExpress ve yabancı havayollarında overbooking</h2>"
        f"<p>{AIRLINES_LIST} kapı önünde imzalatılan feragat formları dikkatle okunmalıdır. "
        "THY business, Pegasus yoğun iç hat veya British Airways, Air France dış hat "
        "uçuşlarında denied boarding tazminatı mesafe bandına göre dosyada hesaplanır.</p>"
    ),
    "makale-bagaj.html": (
        "<h2>Uluslararası uçuşlarda bagaj gecikmesi ve kaybı</h2>"
        "<p>Yurt dışı – Türkiye arası uçuşlarda bagaj çoğu kez Montreal Sözleşmesi (1999) "
        "kapsamında değerlendirilir; SHY-YOLCU yardım yükümlülükleri ile birlikte okunur. "
        "Frankfurt, Dubai, Doha, Londra aktarmalı rotalarda PIR tutanağı varış havalimanında "
        "açılmalıdır.</p>"
        "<h2>Tüm havayollarında bagaj tazminatı</h2>"
        f"<p>{AIRLINES_LIST} bagaj etiketi ve uçuş bacağı belirleyicidir. THY kayıp bagaj, "
        "Pegasus gecikmeli bagaj, Emirates aktarmalı kayıp veya Lufthansa hasarlı valiz "
        "şikâyetlerinde aynı temel evrak seti kullanılır.</p>"
    ),
    "makale-aktarma.html": (
        "<h2>Yurt dışı aktarmalı uçuşları kaçırma</h2>"
        "<p>Almanya, Hollanda, Fransa, İngiltere, BAE ve Katar üzerinden İstanbul veya "
        "Sabiha Gökçen'e; Türkiye'den Avrupa ve Orta Doğu'ya aktarmalı seyahatlerde tek PNR "
        "ile satılan biletlerde taşıyıcı sorumluluğu zincir halinde değerlendirilir. "
        "Schengen transit ve gümrük süreleri bağlantı kaçırma riskini artırır.</p>"
        "<h2>THY, Pegasus, SunExpress ve hub havayolları</h2>"
        f"<p>{AIRLINES_LIST} kombinasyonlarında (THY–Lufthansa, Pegasus–Wizz Air, "
        "SunExpress–Corendon, Emirates–Flydubai) her bacak için boarding pass ve gecikme "
        "kayıtları ayrı saklanmalıdır.</p>"
    ),
    "makale-evrak.html": (
        "<h2>Dış hat uçuş tazminatı evrakları</h2>"
        "<p>Yurt dışı – Türkiye uçuşlarında pasaport, vize kayıtları, uluslararası bilet "
        "ve çok bacaklı boarding pass seti önem taşır. Yabancı havayolu ret mektupları "
        "Türkçe tercüme ile dosyaya eklenebilir.</p>"
        "<h2>Pegasus, THY, SunExpress ve diğer havayolu başvuruları</h2>"
        f"<p>{AIRLINES_LIST} farklı online form kullansa da bilet, PNR, boarding pass "
        "ve gecikme/iptal bildirimi ortak çekirdek evraktır. TK, PC, XQ, LH, EK, QR "
        "kodlu seferlerde uçuş numarası her belgede görünür olmalıdır.</p>"
    ),
    "makale-shy-yolcu.html": (
        "<h2>SHY-YOLCU ve yurt dışı uçuşlar</h2>"
        "<p>Türkiye'den kalkış yapan tüm dış hat uçuşları SHY-YOLCU kapsamındadır; taşıyıcı "
        "Türk veya yabancı olabilir. Türkiye'ye varış yapan uçuşlarda taşıyıcının kayıtlı "
        "olması gerekir. AB'den kalkışlı uçuşlarda EC 261/2004 ile birlikte değerlendirme "
        "yapılabilir; hangi mevzuatın öncelikli olduğu rotaya göre dosyada belirlenir.</p>"
        "<h2>Türk ve uluslararası havayolları</h2>"
        f"<p>{AIRLINES_LIST} yolcu hakları aynı yönetmelik çerçevesinde okunur. "
        "THY dış hat, Pegasus Avrupa, SunExpress charter ve Lufthansa, Ryanair, "
        "Emirates uçuşlarında gecikme, iptal ve bagaj hükümleri somut kayda dayanır.</p>"
    ),
    "makale-havayolu-gerekce.html": (
        "<h2>Dış hat uçuşlarda havayolu ret gerekçeleri</h2>"
        "<p>Yurt dışı rotalarda hava muhalefeti, güvenlik ve hava trafik gerekçeleri "
        "sık ileri sürülür. Aynı havalimanından kalkış yapan THY, Lufthansa veya "
        "Emirates seferlerinin karşılaştırılması savunmayı test eder. Teknik arıza "
        "dış hat filolarında da olağanüstü hal sayılmayabilir.</p>"
        "<h2>Pegasus, THY, SunExpress ve global taşıyıcılar</h2>"
        f"<p>{AIRLINES_LIST} ret mektupları somut delille sorgulanmalıdır. "
        "Pegasus teknik arıza, THY slot gecikmesi, Qatar Airways operasyonel "
        "gerekçe iddiaları dosyada ayrı incelenir.</p>"
    ),
    "makale-ucus-masraf.html": (
        "<h2>Dış hat gecikmesinde otel, yemek ve transfer masrafları</h2>"
        "<p>Yurt dışı aktarmada gece konaklaması, Schengen transitinde uzayan bekleme "
        "ve Türkiye dönüşü rötarlarında SHY-YOLCU Madde 7 yardımları gündeme gelir. "
        "Döviz cinsinden otel ve taksi fişleri dosyaya eklenmelidir.</p>"
        "<h2>Tüm havayollarında rötar masrafları</h2>"
        f"<p>{AIRLINES_LIST} müşteri hizmetleri farklı kanallar sunsa da makul otel, "
        "yemek ve ulaşım talepleri yazılı kayda bağlanmalıdır. THY, Pegasus, SunExpress, "
        "Lufthansa ve Emirates gecikme anında verilen kuponlar ayrı değerlendirilir.</p>"
    ),
    "makale-kupon-teklifi.html": (
        "<h2>Dış hat uçuşlarda kupon ve mil teklifleri</h2>"
        "<p>Uluslararası uçuşlarda havayolları sıkça mil, upgrade veya indirim kuponu "
        "sunur. Yurt dışı – Türkiye rotasında imzalanan İngilizce veya yabancı dil feragat "
        "formları dikkatle okunmalıdır; kupon kabulü ile nakdi tazminat hakkı her olayda "
        "ayrı tartışılır.</p>"
        "<h2>Pegasus, THY, SunExpress ve yabancı havayolu kuponları</h2>"
        f"<p>{AIRLINES_LIST} kupon teklifleri yasal tazminat bandı ile karşılaştırılmalıdır. "
        "THY mil, Pegasus indirim kodu, Emirates voucher veya Ryanair kredi teklifi "
        "dosyada ayrı okunur.</p>"
    ),
}

META = {
    "makale-ucus-3-saat.html": (
        "Dış hat uçuş 3 saat gecikme tazminatı: THY, Pegasus, SunExpress, Lufthansa, Emirates, "
        "Qatar Airways, Ryanair. Yurt dışı–Türkiye SHY-YOLCU rehberi."
    ),
    "makale-ucus-iptal.html": (
        "Yurt dışı uçuş iptali tazminatı: THY, Pegasus, SunExpress, AJet, Air France, KLM, "
        "British Airways, easyJet. Türkiye dış hat yolcu hakları."
    ),
    "makale-ucaga-alinmama.html": (
        "Dış hat uçağa alınmama tazminatı: THY, Pegasus, SunExpress, Lufthansa, Emirates, "
        "Qatar Airways overbooking. Yurt dışı–Türkiye denied boarding."
    ),
    "makale-bagaj.html": (
        "Uluslararası uçuş bagaj gecikmesi: THY, Pegasus, SunExpress, Emirates, Lufthansa, "
        "Qatar Airways, Turkish Airlines kayıp bagaj. Yurt dışı–Türkiye PIR rehberi."
    ),
    "makale-aktarma.html": (
        "Yurt dışı aktarmalı uçuş kaçırma: THY, Pegasus, SunExpress, Lufthansa, KLM, "
        "Emirates, Wizz Air İstanbul aktarma tazminatı."
    ),
    "makale-evrak.html": (
        "Dış hat uçuş tazminatı evrakları: THY, Pegasus, SunExpress, Lufthansa, Emirates "
        "başvuru belgeleri. Yurt dışı–Türkiye yolcu dosyası."
    ),
    "makale-shy-yolcu.html": (
        "SHY-YOLCU dış hat yolcu hakları: THY, Pegasus, SunExpress, EC 261, Lufthansa, "
        "Emirates, Qatar Airways. Türkiye yurt dışı uçuş tazminatı."
    ),
    "makale-havayolu-gerekce.html": (
        "Havayolu ret gerekçesi dış hat: THY, Pegasus, SunExpress, Lufthansa, Emirates "
        "olağanüstü hal savunması. Yurt dışı uçuş tazminatı."
    ),
    "makale-ucus-masraf.html": (
        "Dış hat rötar otel ve yemek masrafı: THY, Pegasus, SunExpress, Lufthansa, "
        "Emirates, Qatar Airways. Yurt dışı uçuş SHY-YOLCU Madde 7."
    ),
    "makale-kupon-teklifi.html": (
        "Dış hat uçuş kupon teklifi: THY mil, Pegasus kupon, SunExpress, Emirates, "
        "Lufthansa tazminat hakkı. Yurt dışı–Türkiye yolcu rehberi."
    ),
}

OLD_DISCLAIMER = re.compile(
    r"<p><strong>Bu makale genel bilgi verir\.</strong>.*?</p>",
    re.S,
)


def rebuild_body(fname: str, original: str) -> str:
    m = re.match(
        r"(<p>.*?</p>)(?:\s*<h2>.*?</h2>\s*<p>.*?</p>\s*)*"
        r"(?:<p><strong>Bu makale genel bilgi verir\.</strong>.*?</p>\s*)?"
        r"(.*)",
        original,
        re.S,
    )
    if not m:
        raise ValueError(f"could not parse body: {fname}")
    return m.group(1) + INTRO[fname] + DISCLAIMER + m.group(2)


def update_html_meta(path: Path, desc: str) -> None:
    html = path.read_text(encoding="utf-8")
    if len(desc) > 160:
        desc = desc[:157].rsplit(" ", 1)[0] + "…"
    html = re.sub(
        r'<meta name="description" content="[^"]*"',
        f'<meta name="description" content="{desc}"',
        html,
        1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*"',
        f'<meta property="og:description" content="{desc}"',
        html,
        1,
    )
    if 'name="keywords"' not in html:
        html = html.replace(
            '<meta name="robots"',
            f'<meta name="keywords" content="{KEYWORDS}">\n  <meta name="robots"',
            1,
        )
    else:
        html = re.sub(
            r'<meta name="keywords" content="[^"]*"',
            f'<meta name="keywords" content="{KEYWORDS}"',
            html,
            1,
        )

    def schema_repl(match: re.Match) -> str:
        data = json.loads(match.group(1))
        data["description"] = desc
        data["keywords"] = KEYWORDS.split(", ")[:12]
        return '<script type="application/ld+json">\n  ' + json.dumps(data, ensure_ascii=False) + "\n  </script>"

    html = re.sub(
        r'<script type="application/ld\+json">\s*(\{.*?\})\s*</script>',
        schema_repl,
        html,
        count=1,
        flags=re.S,
    )
    path.write_text(html, encoding="utf-8")


def main() -> None:
    json_path = ROOT / "data" / "bodies_ucus.json"
    bodies = json.loads(json_path.read_text(encoding="utf-8"))

    for fname in UCUS_FILES:
        if fname not in bodies:
            print(f"skip missing json: {fname}")
            continue
        bodies[fname] = rebuild_body(fname, bodies[fname])
        print(f"body {fname}")

    json_path.write_text(json.dumps(bodies, ensure_ascii=False, indent=2), encoding="utf-8")

    for fname in UCUS_FILES:
        update_html_meta(ROOT / fname, META[fname])
        print(f"meta {fname}")


if __name__ == "__main__":
    main()
