# Bilinçli Tüketici Platformu

sade tüketici sitesi. İlk açık bölüm: uçuş tazminatı.

Uçuş kaydı, yildirimsimsek.av.tr’deki Aviation Edge entegrasyonu ile aynı sunucu yolunu kullanır. Tarayıcı API anahtarını görmez.

## Yerel çalıştırma

1. `api/lib/local-config.example.php` dosyasını `api/lib/local-config.php` olarak kopyalayın.
2. `AVIATION_EDGE_API_KEY` değerini yazın.
3. Proje kökünde:

```bash
php -S localhost:8080
```

## GitHub + otomatik yayınlama

`main` dalına her `git push` yaptığınızda site dosyaları FTP ile sunucuya yüklenir.

### 1. GitHub deposu oluşturun

1. [github.com/new](https://github.com/new) adresinde yeni repo açın (ör. `bilincli-tuketici-platformu`).
2. **Private** seçmeniz önerilir (API yapılandırması repoda yok ama yine de).

### 2. Projeyi GitHub’a bağlayın

Proje klasöründe (henüz commit yoksa):

```bash
git add .
git commit -m "İlk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/REPO_ADI.git
git push -u origin main
```

### 3. Hosting FTP bilgilerini GitHub’a ekleyin

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret | Örnek | Açıklama |
|--------|--------|----------|
| `FTP_SERVER` | `ftp.bilinclituketiciplatformu.com` | İsim Tescil panelindeki FTP sunucusu |
| `FTP_USERNAME` | `info@bilinclituketiciplatformu.com` veya paneldeki kullanıcı | FTP kullanıcı adı |
| `FTP_PASSWORD` | `••••••••` | FTP şifresi |
| `FTP_SERVER_DIR` | `./public_html/` | Site kök klasörü (panelde farklıysa değiştirin) |
| `FTP_PORT` | `21` | Genelde 21; FTPS kullanıyorsanız paneldeki port |

FTP bilgileri: hosting paneli → **FTP Hesapları** / **Dosya Yöneticisi**.

### 4. Sunucuda bir kez elle yapılacaklar

Otomatik yükleme **şu dosyaları silmez / üzerine yazmaz** (repoda yok):

- `api/lib/local-config.php` — API anahtarı ve admin şifresi
- `api/data/*.json` — onaylı yorumlar
- `api/cache/` — uçuş sorgu önbelleği

İlk kurulumda sunucuda `api/lib/local-config.php` dosyasını elle oluşturun.

### 5. Günlük kullanım

```bash
git add .
git commit -m "Yorum butonu güncellendi"
git push
```

Push sonrası **Actions** sekmesinden yükleme durumunu izleyin (1–3 dk).

### Notlar

- Sadece `main` dalına push deploy tetikler.
- `data/` ve `_revise_articles.py` sunucuya gitmez (geliştirme dosyaları).
- FTP yerine SSH varsa `deploy.yml` içinde `protocol: sftp` ve port `22` kullanılabilir.

## Yayınlama (manuel)

PHP destekleyen bir hosting’e tüm klasörü yükleyin. Domain: `bilinclituketiciplatformu.com`.

Sunucuda `api/lib/local-config.php` oluşturun (git’e girmesin). `api/cache` ve `api/data` yazılabilir olsun.

Evrak ve iletişim adresi: `infobilinclituketiciplatformu@gmail.com`  
Bu adresi domain e-postası olarak açıp mevcut gelen kutunuza yönlendirin.

Başvuru formları şu an Formspree üzerinden iletilir. Kaynak alanı `bilinclituketiciplatformu` olarak işaretlenir.

## Yorum onayı

Kullanıcı yorumları hemen yayınlanmaz.

1. `api/lib/local-config.php` içine `STORIES_ADMIN_PASSWORD` yazın.
2. Site yayındayken `/admin/yorumlar.html` adresine girin.
3. Bekleyen yorumu **Onayla ve yayınla** deyin. Onaylanan yorum Deneyimler sayfasında ve anasayfada görünür.

## Sonraki bölümler

- Araç değer kaybı
- Ayıplı ürün / hizmet
- Kira ve depozito
- E-ticaret iade
- Tüketici Hakem Heyeti
