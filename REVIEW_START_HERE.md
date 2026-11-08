# Boundle — yazılımcı inceleme paketi

Canlı oyun: https://aralik-daily.acr0bat.chatgpt.site/

Bu paket son yayınlanan sürümün kaynak kodunu içerir. Kaynak commit: `09f018ab4135973ff8334d125555ae9a080f6510`. Dışa aktarma: 8 Kasım 2026. `review/` klasörü ve bu dosya incelemeyi kolaylaştırmak için ayrıca eklendi; canlı kodun parçası değildir. Kaynak repo değiştirilmedi.

## Hızlı başlangıç

Node.js 24 LTS ve projedeki `packageManager` alanına uygun pnpm 11.25.0 kullanın. Paketi açın ve terminali `Boundle` klasöründe çalıştırın:

```sh
pnpm install --frozen-lockfile
node review/prepare-local.mjs
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
```

Tarayıcı: http://127.0.0.1:5173/

Yerel veritabanı şeması ilk komutta hazırlanır; soru havuzu ilk oyun isteğinde idempotent olarak yüklenir. Uzak hesaba giriş veya API anahtarı gerekmez. `cloudflare:workers` nedeniyle uygulama düz statik HTML olarak veya yalnızca `next dev` ile çalışmaz. Normal `npm run dev` de starter üzerinden kullanılabilir; yukarıdaki Vite komutu port ve adresi açıkça sabitler.

### Yönetim panelini yerelde inceleme

Temiz pakette, geliştirme sunucusu başlamadan önce aşağıdaki komutu kullanın:

```sh
node review/prepare-local.mjs --admin
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173
```

Ardından http://127.0.0.1:5173/admin adresini açın. `--admin`, mevcut kodun yalnızca Vite geliştirme sunucusunda etkinleşen kurgusal kimlik mekanizmasını açar. E-posta gerçek değildir; yerel `.dev.vars` ve `.sites-runtime/admin-preview.json` dosyalarına yazılır. Bu dosyalar yayına taşınmaz. Mevcut kimlik dosyaları varsa yardımcı onları ezmez. Canlı `/admin` için bu mekanizma kullanılamaz; gerçek sahibin yetkisi gerekir. İnceleme için canlı yönetici hesabı paylaşılmasına gerek yoktur.

## Kodun haritası

| Konu | Dosya / klasör |
|---|---|
| Oyuncu arayüzü, günlük tur, sonuç ve tekrar | `app/page.tsx` |
| Tasarım ve başlık/meta bilgileri | `app/globals.css`, `app/layout.tsx` |
| Aralık daralma animasyonu ve ses | `components/game/AnswerSweep.tsx`, `lib/audio.ts` |
| Puanlama | `lib/scoring.ts` |
| Soru havuzları ve günlük seçim | `lib/question-bank.ts`, `lib/game.ts`, `lib/content.ts` |
| Günlük cevap, tekrar ve istatistik API'leri | `app/api/` |
| Oyuncu kaydı / D1 işlemleri | `lib/server.ts`, `lib/insights.ts` |
| Yönetim arayüzü | `app/admin/` |
| Yönetim yetkisi, CSV, soru/takvim işlemleri | `lib/admin-server.ts`, `lib/admin-model.ts` |
| Bağımsız yönetici JWT doğrulaması | `lib/access-auth.ts` |
| Veritabanı şeması ve SQL migration'ları | `db/`, `drizzle/` |
| Testler | `tests/` |
| Mevcut Sites Worker / bağımsız Worker | `worker/index.ts`, `worker/standalone.ts` |
| Bağımsız yayın komutları ve ayar şablonları | `scripts/standalone*.mjs`, `deployment/` |

## İşleyiş

- Oyuncu arayüzü İngilizce; yönetim paneli Türkçe. Önceki Aralık/Distance adları bazı iç değişken, çerez, belge ve kaynak isimlerinde kalmıştır. Bunlar veri sürekliliğini korumak için topluca değiştirilmemiştir.
- Günlük 5 soru: 2 kolay, 2 orta, 1 zor; 5 kategori. UTC 00.00'da yeni gün başlar.
- Oyuncu iki sınırı da açıkça seçer. İçinde doğru cevap varsa `round(200 × (1 − seçilen genişlik / toplam genişlik)²)`; ıskada 0. Soru başına 200, tur başına 1000. Eski günlerin puanlama sürümü korunur.
- Günlük ilk cevaplar sunucuda saklanır; alıştırma ve tekrar ilk skoru değiştirmez.
- Günlük sorular anlık görüntü olarak sabitlenir. Sonraki soru düzenlemeleri açılmış turları değiştirmez.
- Açık oyun API'si tahmin edilmemiş cevapları vermez. Karşılaştırma, tamamlanmış ilk turlardan hesaplanır; henüz başka oyuncu yoksa uydurma ortalama gösterilmez.
- Soru bankası, cevapları ve test kayıtları kaynak kod içinde bulunur. Bu paketi geliştirme/inceleme amacıyla paylaşın; kaynak kodu oyunun açık statik dizinine koymayın.

## Teknik altyapı ve doğrulama

React 19.2.6, TypeScript 5.9.3, Vinext 1.0.0-beta.5 / Vite 8.0.13, Cloudflare Worker, D1/SQLite, Drizzle ve jose. Kesin sürümler ve kilit dosyası pakettedir. Vinext beta bağımlılığı yayına geçiş incelemesinde ayrıca değerlendirilmelidir.

```sh
npm test
pnpm exec tsc --noEmit
npm run build
```

Önceki doğrulamalar: bağımsız yayın altyapısı ve İngilizce arayüz sürümünde 42 test; son isim değişikliğinde ilgili 13 istatistik/paylaşım testi ve üretim derlemesi geçti. Bu dışa aktarma sırasında bağımlılıklar yeniden kurulup uygulama yeniden derlenmedi; ZIP bütünlüğü, kaynak eşleşmesi, yardımcı betik sözdizimi ve dosya sağlama toplamları kontrol edildi. Yerel kurulum yardımcısının geliştiricinin işletim sisteminde çalışması ayrıca doğrulanmalıdır.

## Yayın ve yetki durumu

Mevcut canlı adres Sites üzerinde. Kullanıcıya ait bağımsız Cloudflare hesabına ve özel alan adına geçiş **henüz yapılmadı**. Bağımsız Worker, yapılandırma, Access JWT doğrulaması ve yedek komutları hazırlanmış durumda; bunlar canlı bağımsız kurulum yapılmış anlamına gelmez. Ayrıntılı plan `docs/BAGIMSIZ-YAYIN.md` içindedir.

Mevcut yayında yönetim kimliği Sites tarafından doğrulanır. Bağımsız hedefte Cloudflare Access imzası, issuer, audience ve süre doğrulanır; sunucu sahip kimliğini ayrıca kontrol eder. MFA zorunluluğu Cloudflare Access politikasında ayrıca kurulup gerçek hesapla test edilmelidir. Yerel kurgusal kimlik üretim doğrulaması değildir.

`.openai/hosting.json` kaynakla eşleşmesi için korunmuştur. İçindeki proje kimliği bir şifre değildir; bu kimliği başka bir proje için kullanmayın. Bu inceleme paketi canlı sunucuya yayın yapma yetkisi vermez. `standalone:deploy` gibi uzak komutlar inceleme için gerekli değildir.

## İncelemede özellikle değerlendirilecekler

1. Bağımsız hedefin gerçek hesap/domain/Access MFA/D1 yapılandırması; anonim ve başka hesaptan yönetim erişiminin reddi.
2. Origin kontrolleri, JWT hata yolları, istek sınırlama, kötüye kullanım ve anonim çerez silerek tekrar oyuncu oluşturma sınırları.
3. Eşzamanlı cevaplar, tekrar gönderim, UTC gün geçişi, takvim kilitleri ve farklı puanlama dönemlerinde raporlama.
4. Yönetimde İngilizce alanları boş bırakılabiliyor; mevcut doğrulama Türkçe metne dönebiliyor. İngilizceye özel oyuncu yayını için içerik doğrulamasının sıkılaştırılması değerlendirilmeli.
5. Mobil Safari/iPhone'da fiziksel cihaz ses testi, klavye ve ekran okuyucu kullanımı, mobil görünüm.
6. D1 veri aktarımı, tam yedek/kurtarma denemesi ve ölçek/bütçe planı. Yönetimdeki CSV dışa aktarımı tam veritabanı yedeği değildir.

Bağımsız yayın, fiziksel cihaz ses denemesi, yük testi ve dış güvenlik denetimi tamamlanmış olarak sunulmuyor. Eski README ve tasarım belgeleri geçmiş sürümleri anlatabilir; güncel durum için bu dosyayı ve kaynak kodu esas alın.

## Pakette olmayanlar

Gerçek yönetici e-postası/şifresi, API token'ı, oturum çerezi, `.git` geçmişi, `.dev.vars`, bağımlılık klasörü, derlenmiş çıktı, canlı oyuncu verisi ve canlı DB yedeği yoktur. Eski tasarım arşivleri, örnek projeler ve tarayıcı test ekran görüntüsü kapsam dışında bırakıldı. Tam liste ve commit `review/PROVENANCE.json` dosyasında; SHA-256 listesi `review/SHA256SUMS.txt` içindedir.
