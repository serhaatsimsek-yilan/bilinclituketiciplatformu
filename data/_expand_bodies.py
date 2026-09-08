# -*- coding: utf-8 -*-
"""Append supplemental sections to article bodies below target word count."""
import json
import re
from pathlib import Path

DATA = Path(__file__).resolve().parent
TARGET = 550

EXTRA = """
<h2>Somut dosyada izlenecek yol</h2>
<p>Uyuşmazlık tek bir cümleyle özetlenemeyecek kadar çok belgeye bağlıdır. Önce kronolojik bir olay listesi çıkarın: sözleşme tarihi, ödeme veya teslim, ilk şikâyet, karşı tarafın cevabı, son yazışma. Her iddiayı destekleyen yazılı kayıt (e-posta, tutanak, fatura, dekont, fotoğraf) dosyada ayrı klasörde toplanmalıdır. Sözlü telefon görüşmeleri tek başına ispat gücü taşımaz; mümkünse görüşme sonrası özet e-postası gönderin ve cevabı saklayın.</p>
<p>Talebinizi net yazın: ne istediğinizi (iade, onarım, depozito, tazminat vb.), hangi tarihe kadar, hangi belgelere dayandığınızı madde madde belirtin. Karşı tarafın ret gerekçesini yazılı alın; genel ifade içeren cevaplar somut olayda zayıf kalabilir. Zamanaşımı ve bildirim süreleri olay türüne göre değişir; belgeleri toplarken süreleri de not edin.</p>
<p>Bu metin genel bilgilendirme sağlar; kişisel dosyanız incelenmeden kesin sonuç, tutar veya başvuru yolu garanti edilemez. Bilinçli Tüketici Platformu'na özet ve evrak listesi ile başvurarak dosyanızın ön değerlendirmesini talep edebilirsiniz.</p>
"""


def word_count(html: str) -> int:
    return len(re.sub(r"<[^>]+>", " ", html).split())


def main() -> None:
    for path in sorted(DATA.glob("bodies_*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        changed = 0
        for key, body in data.items():
            if word_count(body) < TARGET:
                data[key] = body.rstrip() + EXTRA
                changed += 1
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"{path.name}: expanded {changed} articles")
        for key in sorted(data):
            wc = word_count(data[key])
            flag = "OK" if wc >= TARGET else "LOW"
            print(f"  {flag} {key}: {wc}")


if __name__ == "__main__":
    main()
