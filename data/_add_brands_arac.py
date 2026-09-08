# -*- coding: utf-8 -*-
"""Add car brand SEO keywords to vehicle articles."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

ARAC_FILES = [
    "makale-sifir-arac-boya.html",
    "makale-gizli-ayip-ikame.html",
    "makale-ayipli-sifir-arac.html",
    "makale-teslimat-hasar.html",
    "makale-garanti-disi.html",
    "makale-teslim-gecikmesi.html",
    "makale-arac-deger-kaybi.html",
    "makale-stok-siparis.html",
    "makale-kampanya-fiyat.html",
    "makale-recall-guvenlik.html",
]

BRANDS = (
    "Renault, Fiat, Volkswagen, Ford, Hyundai, Kia, Toyota, Peugeot, Citroën, Opel, "
    "Skoda, Dacia, Honda, Nissan, BMW, Mercedes-Benz, Audi, Volvo, Seat, Togg"
)

BRAND_INTRO = {
    "makale-sifir-arac-boya.html": (
        "<h2>Renault, Volkswagen, Fiat ve diğer markalarda boya–parça kontrolü</h2>",
        f"<p>Sıfır {BRANDS} ve benzeri markalarda teslim sonrası boya kalınlığı ölçümü veya değişen parça tespiti aynı ayıplı mal hükümlerine tabidir. "
        "Renault Clio, VW Polo, Fiat Egea, Hyundai i20 veya Toyota Corolla gibi modellerde bayinin \"stok sıfır\" beyanı ile ekspertiz raporu karşılaştırılır. "
        "Marka veya model tek başına sonucu belirlemez; satış sözleşmesi, teslim tutanağı ve Tramer kaydı birlikte incelenir.</p>",
    ),
    "makale-gizli-ayip-ikame.html": (
        "<h2>Ford, Hyundai, Renault ve diğer markalarda servis–ikame süreci</h2>",
        f"<p>{BRANDS} marka sıfır araçlarda gizli ayıp nedeniyle yetkili serviste uzun bekleme ve ikame araç verilmemesi sık görülür. "
        "Ford Focus, Hyundai Tucson, Renault Megane veya Kia Sportage sahipleri de 6502 sayılı Kanun kapsamında yazılı bildirim ve servis iş emri kaydı oluşturmalıdır. "
        "Distribütör ve bayi muhataplığı, garanti belgesinden anlaşılır; marka adı dosyada tanımlayıcı bilgi olarak yer alır.</p>",
    ),
    "makale-ayipli-sifir-arac.html": (
        "<h2>Sıfır araçta ayıp: Toyota, Peugeot, Skoda ve diğer markalar</h2>",
        f"<p>{BRANDS} dahil tüm sıfır araç alımlarında onarım, değişim, iade ve indirim seçenekleri 6502 sayılı Kanun'un 11. maddesine göre değerlendirilir. "
        "Toyota Yaris, Peugeot 3008, Skoda Octavia veya Dacia Duster örneklerinde ayıbın ağırlığı belirleyicidir. "
        "Yetkili servis yalnızca garanti kapsamında işlem yapıyorsa bile satıcıya ayrı ayıp bildirimi yapılmalıdır.</p>",
    ),
    "makale-teslimat-hasar.html": (
        "<h2>Volkswagen, Opel, Nissan teslimatta hasar</h2>",
        f"<p>{BRANDS} marka araçların bayi veya limandan tesliminde çizik, cam kırığı veya eksik donanım tespiti aynı hukuki çerçevede incelenir. "
        "VW Golf, Opel Corsa, Nissan Qashqai veya Mercedes-Benz A Serisi teslimlerinde giriş–çıkış tutanağı ve fotoğraf delili kritiktir. "
        "Hasarın nakliye mi bayi mi kaynaklı olduğu somut kayıtlarla ayrılır; marka fark etmez.</p>",
    ),
    "makale-garanti-disi.html": (
        "<h2>Ford, BMW, Audi yetkili servis ve garanti dışı iddiası</h2>",
        f"<p>{BRANDS} yetkili servislerinin \"garanti dışı\" veya \"kullanıcı hatası\" demesi, tüketicinin ayıp talebini otomatik olarak sona erdirmez. "
        "Ford, BMW 3 Serisi, Audi A3 veya Honda Civic gibi modellerde servis raporu, üretici parça kodu ve satıcı yazışmaları dosyada bir arada tutulmalıdır. "
        "Garanti belgesi ile ayıplı mal hükümleri karıştırılmamalı; her iki başlık ayrı yazılı başvuru konusu yapılabilir.</p>",
    ),
    "makale-teslim-gecikmesi.html": (
        "<h2>Sipariş teslim gecikmesi: Skoda, Kia, Togg ve diğer markalar</h2>",
        f"<p>{BRANDS} marka fabrika veya stok siparişlerinde teslim gecikmesi TBK ve 6502 sayılı Kanun çerçevesinde değerlendirilir. "
        "Skoda Kamiq, Kia Ceed, Togg T10X veya Renault Austral siparişlerinde sözleşmedeki teslim tarihi ile fiili teslim karşılaştırılır. "
        "Bayi \"üreticiden kaynaklı\" gerekçesi yazılı ve belgelendirilmiş olmalıdır.</p>",
    ),
    "makale-arac-deger-kaybi.html": (
        "<h2>Kaza sonrası değer kaybı: Mercedes, BMW, Volkswagen</h2>",
        f"<p>{BRANDS} marka araçlarda trafik kazası sonrası değer kaybı talebi, hasar tutarı, onarım kalitesi ve km bilgisine göre incelenir. "
        "Mercedes-Benz C Serisi, BMW X1, VW Passat veya Audi Q3 gibi modellerde ekspertiz raporu ve Tramer kaydı esastır. "
        "Sıfır araç ayıp uyuşmazlığından farklı olarak değer kaybı dosyası ayrı açılır; marka SEO araması somut raporla desteklenmelidir.</p>",
    ),
    "makale-stok-siparis.html": (
        "<h2>Stok ve sipariş uyuşmazlığı: Peugeot, Dacia, Fiat</h2>",
        f"<p>{BRANDS} bayilerinde stok araç ile sipariş formundaki donanım, renk veya motor seçeneği uyuşmazlığı ayıplı mal ve ifa uyuşmazlığı olarak değerlendirilebilir. "
        "Peugeot 208, Dacia Sandero, Fiat 500X veya Citroën C3 Aircross örneklerinde sipariş formu, ön bilgilendirme ve teslim edilen araç karşılaştırılır. "
        "Stok etiketi tek başına tüketiciyi daha düşük donanımlı araca razı etmez.</p>",
    ),
    "makale-kampanya-fiyat.html": (
        "<h2>Kampanya ve fiyat: Renault, Hyundai, Ford sıfır araç</h2>",
        f"<p>{BRANDS} marka sıfır araç satışlarında kampanya faizi, peşin fiyat veya teslim tarihi değişikliği sipariş anındaki yazılı koşullara bağlıdır. "
        "Renault Taliant, Hyundai Bayon, Ford Puma veya Toyota C-HR kampanyalı satışlarında broşür, web ekran görüntüsü ve sözleşme birlikte incelenir. "
        "Banka kredi faizi ile bayi kampanya taahhüdü ayrı değerlendirilir.</p>",
    ),
    "makale-recall-guvenlik.html": (
        "<h2>Çağrı kampanyası: Toyota, Volkswagen, Nissan</h2>",
        f"<p>{BRANDS} marka araçlarda üretici çağrı (recall) kampanyası, emniyet kemeri, hava yastığı, yazılım veya fren sistemi gibi konuları kapsayabilir. "
        "Toyota Corolla, Volkswagen Tiguan, Nissan Juke veya Volvo XC40 sahipleri yetkili serviste ücretsiz onarım hakkına sahiptir. "
        "Recall sonrası tekrarlayan arıza veya güvenlik ayıbında 6502 sayılı Kanun'daki seçimlik haklar ayrıca değerlendirilir.</p>",
    ),
}

META_DESC = {
    "makale-sifir-arac-boya.html": "Renault, VW, Fiat sıfır araçta değişen boya ve parça: ayıplı mal hakları, ekspertiz ve başvuru rehberi.",
    "makale-gizli-ayip-ikame.html": "Ford, Hyundai, Renault sıfır araç serviste bekleme ve ikame araç: gizli ayıp hakları ve delil listesi.",
    "makale-ayipli-sifir-arac.html": "Toyota, Peugeot, Skoda ayıplı sıfır araç: onarım, değişim, iade hakları. 6502 sayılı Kanun rehberi.",
    "makale-teslimat-hasar.html": "Volkswagen, Opel, Nissan sıfır araç teslim hasarı: tutanak, fotoğraf ve tüketici hakları.",
    "makale-garanti-disi.html": "Ford, BMW, Audi garanti dışı iddiası: yetkili servis, ayıp talebi ve yazılı başvuru adımları.",
    "makale-teslim-gecikmesi.html": "Skoda, Kia, Togg sıfır araç teslim gecikmesi: sipariş sözleşmesi ve tüketici hakları.",
    "makale-arac-deger-kaybi.html": "Mercedes, BMW, VW kaza sonrası araç değer kaybı: ekspertiz, Tramer ve talep rehberi.",
    "makale-stok-siparis.html": "Peugeot, Dacia, Fiat stok araç ve sipariş uyuşmazlığı: donanım farkı ve tüketici hakları.",
    "makale-kampanya-fiyat.html": "Renault, Hyundai, Ford kampanya faizi ve fiyat değişikliği: sıfır araç satış sözleşmesi rehberi.",
    "makale-recall-guvenlik.html": "Toyota, Volkswagen, Nissan çağrı kampanyası: recall, güvenlik ayıbı ve tüketici hakları.",
}


def inject_body(html: str, fname: str) -> str:
    h2, _ = BRAND_INTRO[fname]
    if h2 in html:
        return html
    h2, p = BRAND_INTRO[fname]
    block = h2 + p
    pat = r"(<p><strong>Bu makale genel bilgi verir\.</strong>[^<]*</p>)"
    if re.search(pat, html):
        return re.sub(pat, r"\1" + block, html, count=1)
    return html


def update_meta(html: str, fname: str) -> str:
    desc = META_DESC[fname]
    html = re.sub(
        r'<meta name="description" content="[^"]*"',
        f'<meta name="description" content="{desc}"',
        html,
        count=1,
    )
    html = re.sub(
        r'<meta property="og:description" content="[^"]*"',
        f'<meta property="og:description" content="{desc}"',
        html,
        count=1,
    )

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
    json_path = ROOT / "data" / "bodies_arac.json"
    bodies = {}
    if json_path.exists():
        bodies = json.loads(json_path.read_text(encoding="utf-8"))

    for fname in ARAC_FILES:
        path = ROOT / fname
        html = path.read_text(encoding="utf-8")
        html = inject_body(html, fname)
        html = update_meta(html, fname)
        path.write_text(html, encoding="utf-8")
        print(f"updated {fname}")

        m = re.search(
            r'<section class="card article-content">(.*?)<h2>Platforma başvuru</h2>',
            html,
            re.S,
        )
        if m and fname in bodies:
            bodies[fname] = m.group(1).strip()

    if bodies:
        json_path.write_text(json.dumps(bodies, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"synced {json_path.name}")


if __name__ == "__main__":
    main()
