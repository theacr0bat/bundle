# ARALIK — bağımsız yayın

## Şimdiki durum

Bağımsız yayın için ayrı Worker girişi, yapılandırma, yönetici doğrulaması ve yayın/yedek komutları hazırlandı. Cloudflare hesabı, alan adı, Access politikası ve bağımsız veritabanı henüz kurulmadı. Bu belge tamamlanmış bir bağımsız yayın veya güvenlik denetimi değildir. Mevcut demo adresi çalışmaya devam eder.

## İlk adım: hesabın sende olsun

1. https://dash.cloudflare.com/sign-up adresinden kendi e-posta adresinle hesap aç; hesabın varsa mevcut hesabını kullan.
2. Gelen e-postadaki doğrulama bağlantısını aç.
3. Profil simgesi → My Profile → Authentication bölümünden iki aşamalı doğrulamayı etkinleştir. Kurtarma kodlarını kendin sakla.
4. Sonraki adımda kullanmak istediğin alan adını birlikte seçeceğiz. Mevcut bir alan adın varsa onu kullanabiliriz. Satın alma bedeli ve yenileme tutarı görülmeden ödeme yapılmaz.

Hesap şifresi, doğrulama kodu ve kurtarma kodları sohbet mesajına yazılmaz. Bunları sağlayıcının kendi giriş ekranında gir.

## Kurulum sırası

| Aşama | Yapılacak iş | Tamamlanma ölçütü |
|---|---|---|
| 1 | Kullanıcının Cloudflare hesabı ve hesap 2FA | Kullanıcı kendi paneline girebiliyor |
| 2 | Alan adı ve DNS | Alan adı kullanıcının hesabında etkin |
| 3 | D1 veritabanı | `aralik-db` oluşturuldu, gerçek kimliği kaydedildi |
| 4 | Yönetici kimliği ve Access | Yalnızca sahibin e-postası + zorunlu MFA, tüm yönetim yolları kapsanıyor |
| 5 | Kaynak kodun kullanıcının kontrolüne verilmesi | Tam kaynak, kilit dosyası ve kurtarma belgeleri kullanıcıda |
| 6 | Yapılandırma ve şema | Bağlantılar doğrulandı, iki veritabanı migration dosyası uygulandı |
| 7 | Mevcut verinin yedeği ve gerekiyorsa aktarımı | Kaynak/hedef satır sayıları ve günlük soru anlık görüntüleri eşleşiyor |
| 8 | Bağımsız yayın ve gerçek hesap testi | Oyun herkese açık; anonim/yabancı hesap engelli; sahip MFA ile yönetebiliyor |

Her aşamada yalnızca gereken bilgiler alınır. Hesap henüz bağlı olmadığı için bu adımlar uzaktan tamamlanmış sayılmaz.

## Yönetici koruması

Cloudflare Zero Trust → Access controls → Applications altında self-hosted bir uygulama oluştur. Aynı uygulamada gerçek oyun alan adı için aşağıdaki yolları kapsa; uygulamanın AUD değeri kod yapılandırmasına girilecek:

- `/admin`
- `/admin/*`
- `/api/admin`
- `/api/admin/*`

Allow politikası yalnızca sahibin tam e-posta adresini içermeli. Independent MFA yapılandırılıp bu uygulamada zorunlu tutulmalı; authenticator uygulaması veya güvenlik anahtarı kullanılabilir. Hesap panelindeki 2FA ile oyun yönetimi için Access MFA iki ayrı ayardır; ikisi de tamamlanmalı. Session duration için 1 saatle başla. Bypass, Everyone veya servis tokenıyla yönetici izni verme. Oyun ana sayfasını ve diğer oyun API'lerini bu uygulamanın kapsamına alma.

Sunucu her yönetim isteğinde Access JWT imzasını, RS256 algoritmasını, ekip adresini, uygulama AUD değerini, süreyi, uygulama token türünü ve kullanıcı kimliğini doğrular. Düz e-posta/Sites başlığı yetki vermez. İlk yetkili yazma isteğinde sahibi doğrulanmış Access `sub` kimliğine bağlar; sonraki girişlerde bu kimliği ister. Eski Sites sahibi kaydı ayrı tutulur. POST isteklerinde tam origin eşleşmesi aranır.

MFA zorunluluğu Access politikasında uygulanır. Kodun JWT kontrolü tek başına MFA'nın etkinleştirildiğini kanıtlamaz; gerçek girişte ikinci faktör istenmesi ve Access günlükleri yayından önce kontrol edilir.

`workers.dev` ve önizleme adresleri yapılandırmada kapalıdır. Sonradan başka bir alan adı eklenirse Access kapsamına alınmadan yayın adresi olarak kullanılmaz. Ekip/AUD ayarı eksikse yönetim API'si 503 ile kapalı kalır.

## Teknik uygulama komutları

Bu bölümü birlikte uygulayacağız; kullanıcının kod öğrenmesi gerekmez. Node 22.13 veya üstü ve pnpm gerekir. Kaynak kodun aynı sürümündeki kilit dosyasıyla kurulum yap:

```sh
pnpm install --frozen-lockfile
pnpm exec wrangler login
pnpm exec wrangler d1 create aralik-db
```

`deployment/settings.example.json` dosyasını `deployment/settings.json` olarak kopyala. Gerçek Cloudflare hesap kimliği, D1 kimliği, alan adı, Access ekip adresi, uygulamanın AUD değeri ve sahibin e-postasını gir. Bunlar örnek değerlerle yayınlanamaz. Şifre veya API anahtarı bu dosyaya yazılmaz. Hesap ayarları ve yedekler Git'e dahil edilmez.

```sh
npm run standalone:configure
npm test
pnpm exec tsc --noEmit
npm run standalone:build
npm run standalone:migrate
```

Gerekli eski veri aktarımı ve Access politikası doğrulandıktan sonra:

```sh
npm run standalone:deploy
```

Bu komut yalnızca bağımsız sürümü derleyip kullanıcının Worker'ına yayınlar. Mevcut Sites yayınını değiştirmez. `standalone:build` tek başına uzak sunucuya işlem yapmaz. Hesap ayarı yokken üretilen deneme derlemesi erişime kapalı yönetim ve örnek DB kimliği içerir; bu çıktı gerçek yayın değildir. `standalone:deploy` gerçek ayarları doğrular ve tekrar derler.

Veritabanı migration işlemi yayın komutundan ayrıdır: yeni şema eklenirse önce yedek alınır, migration incelenir ve uygulanır; sonra kod yayınlanır. SQL dosyaları `drizzle/` altında tutulur.

## Veri aktarımı ve yedek

Mevcut veritabanı değişmeden korunur. Taşıma öncesi `questions`, `day_rounds`, `runs` ve gerekli yönetim kayıtları yedeklenir. Soru cevapları ve günlük anlık görüntüler birlikte taşınır; yalnızca soru CSV'si bütün oyun geçmişinin yedeği değildir. Eski sahip kimliği yeni giriş sistemine kopyalanarak yetki verilmez. İlk bağımsız girişte yeni sahip kaydı oluşturulur.

Aktarım yapılacaksa önce boş hedefin şeması uygulanır, sonra tablo/sütun listesi belirli veri aktarımı hazırlanır. Kaynak ve hedefte sayılar, cevap JSON'ları ve gün kilitleri doğrulanır. Bu adım henüz yürütülmedi.

Alan adı değişince tarayıcı çerezi taşınmaz. Eski toplam skor ve tur verileri aktarılabilir; ziyaretçinin yeni alan adındaki anonim oturumunun eski oyuncu kimliğiyle otomatik eşleşeceği vaat edilmez.

Bağımsız veritabanı kurulduktan sonra indirmek için:

```sh
npm run standalone:backup
```

Bu komut tarihli SQL dosyasını `backups/` altında oluşturur. Dosya ayrıca kullanıcının kontrolündeki kalıcı bir yerde saklanmalı. D1 Time Travel sağlayıcının otomatik geçmiş/kurtarma özelliğidir; seçilen planın saklama süresi panelden kontrol edilir. Ayrı bir günlük dışa aktarma zamanlayıcısı bu aşamada kurulmadı.

Geri yükleme önce ayrı bir test veritabanında denenir. Canlı veritabanını silen veya geçmişe döndüren bir komut bu projede otomatik çalışmaz. Yönetici kaydı sıfırlama işlemi yalnızca hesap sahibinin Cloudflare/D1 erişimiyle, eski oturumlar iptal edilerek yapılır.

## Yayın kabul kontrolü

- Gizli pencerede ana sayfa açılır, günlük oyun tamamlanır, skor ve kalabalık karşılaştırması doğru görünür.
- Gizli pencerede `/admin` giriş ister; `/api/admin` hiçbir soru cevabı veya oyuncu raporu vermez.
- Başka hesap yönetim verisini okuyamaz veya değiştiremez.
- Sahip girişinde zorunlu MFA görülür; soru taslağı, CSV yükleme ve geleceğe tur planlama denenir.
- Sahte Sites/e-posta başlıkları yönetici olamaz; süresi dolmuş veya farklı uygulamaya ait JWT reddedilir.
- Alternatif yayın adresleri kapalıdır; yedek indirilir ve test veritabanında açılır.
- Kullanıcı kendi hesabında kodun, alan adının, veritabanının ve erişim ayarlarının kontrolüne sahiptir.

## Resmî başvuru kaynakları

- https://developers.cloudflare.com/fundamentals/account/create-account/
- https://developers.cloudflare.com/fundamentals/user-profiles/2fa/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/
- https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/independent-mfa/
- https://developers.cloudflare.com/cloudflare-one/access-controls/policies/mfa-requirements/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/d1/reference/time-travel/
