# CRM Project — Customer 360 ve Lead-to-Cash ürün yol haritası

Bu doküman, “Customer 360, satış pipeline'ı, teklif versiyonları, müşteri portalı,
ödeme yönetimi ve servis tipine özel müşteri ilişkileri” önerilerini bu repodaki
gerçek veri modeli ve mevcut akışlara uyarlar.

Bu bir saha/çalışan yönetim sistemi yol haritası değildir. Ürün yönü:

> İsviçre'deki taşınma, temizlik ve benzeri hizmet firmaları için müşteri yaşam
> döngüsü ve gelir yönetimi CRM'i: Lead → Offerte → kabul/Nachtrag → Auftrag →
> Rechnung → Zahlung → tekrar satış.

## 1. Mevcut sistemde zaten bulunan temel

| Alan | Mevcut durum | Yol haritasındaki karşılığı |
|---|---|---|
| Talep | `leads` aktif kanonik talep tablosu | Satış fırsatının başlangıcı olarak kalır |
| Teklif | `offers`, `offer_items`, `offer_inventory_items` | Aynı tablolar versiyonlanarak kullanılacak |
| Teklif kanıtı | `sent_at`, `viewed_at`, `accepted_at`, `rejected_at`, AGB hash/IP migration'ı | Append-only kabul olayı ve frozen PDF ile güçlendirilecek |
| Scope snapshot | `offers.frozen_*`, `auftraege.items`, `extra_services`, `service_details`, finansal alanlar | Korunacak; kanonik müşteri bu snapshot'ların yerine geçmeyecek |
| İş emri | `auftraege` ve status state machine | Kabul edilen teklif/Nachtrag kapsamının uygulama kaydı olarak kalır |
| Takvim | `appointments`; `follow_up` tipi de mevcut | Pipeline görevleriyle ilişkilendirilecek, görev tablosunun yerine geçmeyecek |
| Finans | `rechnungen`, `quittungen`, QR-Bill, basit paid/overdue statüsü | Payment ledger ve allocation ile lead-to-cash'e genişleyecek |
| Gelen e-posta | `inbound_emails` review kuyruğu | Shared inbox değil; ileride iletişim katmanına bağlanacak |
| Public alan | Teklif, randevu ve besichtigung token sayfaları | Kalıcı müşteri portalının ilk yapı taşları |
| Yetkilendirme | `company_members`, rol yardımcıları ve yeni guard migration'ları | Yeni bütün tablolarda company-scoped RLS zorunlu |

Önemli not: Repoda rol koruması, accounting delete guard, secret ayrıştırma,
teklif kabul kanıtı ve transaction'lı arşivleme için yeni migration'lar bulunuyor.
Yeni ürün geliştirmesinden önce bunların canlı veritabanına uygulandığı, generated
types ve integration-test baseline'ının güncel olduğu doğrulanmalıdır.

## 2. Metindeki öneriler için projeye özel mimari kararlar

### 2.1 Customer 360 yeni kaynak, belge snapshot'ları tarihsel kaynak olacak

`customers` güncel müşteri bilgisinin kanonik kaynağıdır. Buna rağmen teklif,
Auftrag, Rechnung ve Quittung üzerindeki `customer_*` alanları kaldırılmaz. Bunlar
belgenin oluşturulduğu andaki değiştirilemez müşteri snapshot'ıdır.

İlk geçişte aşağıdaki tablolara nullable `customer_id` eklenir:

- `leads`
- `offers`
- `auftraege`
- `appointments`
- `rechnungen`
- `quittungen`
- `inbound_emails`

Yeni kayıtlar server-side bir RPC/domain service üzerinden müşteriye bağlanır.
Mevcut kayıtlar additive ve geri alınabilir bir backfill ile eşleştirilir; müşteri
snapshot alanları toplu olarak yeniden yazılmaz.

### 2.2 `customer_timeline` kopya veri tablosu olmayacak

Lead, teklif, randevu, Auftrag, fatura ve ödeme olaylarını ikinci kez bir timeline
tablosuna kopyalamak drift üretir. Bunun yerine:

- Telefon notu, manuel not ve müşteri teması için `crm_activities` tutulur.
- Gerçek domain olayları kendi tablolarında kalır.
- `customer_timeline_v` view/RPC; domain olayları, iletişimler ve manuel aktiviteleri
  tek, sayfalanabilir akış olarak birleştirir.
- Kanıt niteliğindeki kabul, ödeme ve izin değişiklikleri append-only tablolarda kalır.

### 2.3 `offer_versions` içinde ikinci bir teklif kopyası oluşturulmayacak

Teklif zaten çok sayıda kolon ve çocuk tablo içeriyor. Ayrı bir `offer_versions`
tablosunda aynı yapıyı JSON olarak tekrar etmek yerine her `offers` satırı bir
versiyon olur:

- `offer_series_id UUID`
- `version_number INTEGER`
- `supersedes_offer_id UUID NULL`
- `revision_reason TEXT NULL`
- `locked_at TIMESTAMPTZ NULL`
- `superseded_at TIMESTAMPTZ NULL`

`(company_id, offer_series_id, version_number)` benzersiz olmalıdır. Revizyon,
mevcut teklif ve çocuk kayıtlarını transaction içinde klonlar; eski access token
ve içerik yeni versiyonu değiştirmez.

### 2.4 Taşınma envanteri müşterinin kalıcı özelliği değildir

Eşya envanteri her taşınmada değişebilir. Bu nedenle doğrudan `customers`
altında tek bir kalıcı liste yerine lead/teklif serisi/Auftrag'a bağlı, versiyonlu
bir `move_scope` olmalıdır. Customer 360 bu scope'ları gösterir fakat geçmiş bir
taşınmanın envanterini yeni taşınmaya otomatik kopyalamaz.

### 2.5 Temizlik “property” modeli bütün servislerde kullanılabilecek şekilde kurulacak

Yalnızca `customer_properties` yerine genel `service_locations` kullanılır.
Taşıma başlangıç/varış adresleri, temizlik objeleri ve depolama lokasyonları bu
varlığa bağlanabilir. Belgedeki adres snapshot'ları yine korunur.

## 3. Hedef domain modeli

```text
customers
├── customer_contacts
├── customer_addresses / service_locations
├── customer_tags
├── customer_consents            (append-only)
├── crm_activities               (not, arama, manuel temas)
├── crm_tasks                    (next action / takip)
├── communication_threads
│   └── communication_messages
├── leads
│   └── offer series
│       ├── offer v1 ── offer_items / inventory / frozen scope
│       ├── offer v2 ── offer_items / inventory / frozen scope
│       └── accepted version ── auftraege
│                              └── offer_amendments (Nachtrag)
├── appointments
├── rechnungen
│   └── payment_allocations ── payments
├── service_contracts          (özellikle Unterhaltsreinigung)
└── customer_cases             (hasar, şikâyet, Nachreinigung)
```

### Customer 360 çekirdek tabloları

#### `customers`

- `id`, `company_id`
- `customer_type`: `person | company`
- `display_name`, kişi/firma adı alanları
- `primary_email`, `primary_phone`, `language`
- `status`: `active | inactive | blocked | anonymized`
- `source`, `first_lead_at`, `last_activity_at`
- `merged_into_customer_id`, `possible_duplicate`
- `created_at`, `updated_at`

#### `customer_contacts`

B2B müşteriler ve aile/temsilci ilişkileri için kullanılır. Bir müşteri için birden
fazla karar verici, fatura kişisi veya sahadaki kontak tutulabilir.

#### `customer_addresses`

- Adres türü: `billing | service | origin | destination | storage | other`
- Normalize adres alanları ve serbest erişim notu
- `valid_from`, `valid_to`, `is_primary`

Adresin belge üzerinde nasıl göründüğü teklif/fatura snapshot'ında ayrıca kalır.

#### `customer_tags` ve `customer_tag_links`

“Tekrar müşteri”, “VIP”, “Hausverwaltung”, “Depolama adayı” gibi firma tarafından
yönetilen segmentler. Kritik iş statüleri tag ile modellenmez.

#### `customer_consents`

İzin kayıtları update edilmez; yeni olay eklenir:

- `consent_type`, `granted`
- `captured_at`, `source`
- `policy_version`, `evidence`

### Müşteri eşleştirme kuralı

Otomatik birleştirme yalnızca güçlü eşleşmede yapılır:

1. Aynı firma + normalize e-posta + normalize telefon → otomatik bağla.
2. Yalnızca e-posta veya yalnızca telefon eşleşirse duplicate adayı göster.
3. Sadece ad/soyad/adres benzerliğinde otomatik merge yapma.
4. Merge yalnızca owner/admin tarafından, audit log ve geri izlenebilir yönlendirme
   ile yapılır.

## 4. Uygulama sırası

### Faz 0 — Üretim temelini kapat

Customer 360'a başlamadan önce:

- Son güvenlik/accounting/acceptance/archive migration'larının prod durumunu doğrula.
- Production migration zinciri için temiz kurulum veya desteklenen baseline oluştur.
- DB integration baseline'ına `inbound_emails` ve son migration'ları ekle.
- CI'a type-check, CRM lint, unit, build ve DB integration gate'leri ekle.
- Dashboard'daki kalıntı `lead_distributions` sorgularını aktif `leads` modeliyle değiştir.
- Company context ve rol matrisini bütün CRM sayfalarında tekleştir.

Metindeki “Kostendach ve temizlik bütünlüğü bug'ları” bu repoda artık genel bir
başlangıç maddesi olarak ele alınmamalıdır. Kostendach, cleaning metadata ve Auftrag
snapshot'ları için testler mevcut. Yeni Customer 360 geliştirmesinden önce manuel
create/edit/PDF/kabul regression senaryosu çalıştırılmalı; sadece yeniden üretilebilen
bir hata varsa bloklayıcı kabul edilmelidir.

### Faz 1 — Customer 360 MVP

#### Backend

1. `customers`, `customer_contacts`, `customer_addresses`, tag ve consent tabloları.
2. Mevcut çekirdek tablolara nullable `customer_id`.
3. Company-scoped index, FK ve rol bazlı RLS.
4. `resolve_or_create_customer`, `merge_customers` ve backfill RPC/script'i.
5. `customer_summary` ve sayfalanabilir `customer_timeline` RPC'leri.

#### Frontend

- `/firma/kunden`
- `/firma/kunden/:customerId`
- Mevcut `MODULES.contacts` flag'i bu route'a bağlanır.
- Liste: ad, iletişim, son aktivite, açık fırsat, açık alacak, toplam tahsilat.
- Detay: özet, timeline, teklifler, Aufträge, randevular, finans, dosyalar/notlar.
- Lead/offer/order/invoice ekranında müşteri kartına link.
- Duplicate adaylarını inceleme ve kontrollü merge ekranı.

#### Tamamlanma kriterleri

- Yeni lead güçlü eşleşmede doğru müşteriye bağlanır.
- Bir müşterinin bütün mevcut domain kayıtları tek kartta görünür.
- Müşteri e-postası değişince eski fatura/teklif snapshot'ı değişmez.
- Firma A kullanıcısı Firma B müşterisini hiçbir sorgu/RPC ile göremez.
- 1.000+ müşteride server-side arama ve pagination çalışır.

### Faz 2 — Teklif versiyonu, kabul ve Nachtrag

1. Gönderilmiş teklif kilitlenir; doğrudan edit yerine “Yeni versiyon oluştur”.
2. Revizyon bütün offer items, inventory, fiyat, adres ve scope snapshot'larını klonlar.
3. Eski public link eski versiyonu salt okunur gösterir ve güncel versiyona yönlendirme
   mesajı verir; eski versiyondan kabul yapılamaz.
4. Kabul edilen versiyon immutable olur.
5. Frozen PDF/storage path, PDF SHA-256, AGB hash, server timestamp ve request kanıtı
   append-only `offer_acceptance_events` kaydına yazılır.
6. Kabul sonrası değişiklik `offer_amendments`/Nachtrag ile yapılır; müşteri bunu ayrıca
   kabul veya reddeder.
7. Auftrag yalnızca kabul edilen teklif + kabul edilmiş Nachtrag'ların scope'unu kullanır.

### Faz 3 — Satış pipeline ve takip otomasyonları

Bu CRM'de ayrı bir “opportunity” tablosu başlangıçta gerekli değildir; aktif `lead`
satış fırsatıdır.

Önerilen aşamalar:

`new → qualifying → inspection → offer_draft → offer_sent → negotiating → won/lost`

Ek yapılar:

- `crm_tasks`: owner, due date, type, priority, related entity, completion.
- Lead üzerinde `sales_stage`, `owner_member_id`, `next_action_at`.
- Kaybedilen iş için zorunlu `lost_reason_code` ve opsiyonel açıklama.
- `source`, `campaign`, `referrer` attribution alanları.
- Aşama değişiklikleri `sales_stage_history` içinde append-only tutulur.

İlk otomasyonlar:

1. Gönderilen teklif 24 saat açılmadı → müşteriye tek hatırlatma.
2. Açıldı, belirlenen sürede yanıt yok → firma için takip görevi.
3. Geçerlilik bitimine yaklaştı → firma bildirimi; otomatik müşteri mesajı ayarla açılır.
4. Ret → yapılandırılmış kayıp nedeni görevi.
5. Kabul edilen taşınma → temizlik/kutu/depolama cross-sell önerisi.

Her otomasyon idempotent olmalıdır. `automation_deliveries` üzerinde
`(rule_key, entity_type, entity_id, schedule_window)` unique kısıtı tekrar mesajı önler.

### Faz 4 — Lead-to-cash finans

Mevcut `rechnungen.status = bezahlt` manuel işareti finansal kaynak olarak yeterli
değildir. Hedef model:

#### `payments`

- Müşteri, tutar, para birimi, ödeme tarihi
- Yöntem: banka, QR, nakit, TWINT, kart, diğer
- Banka/provider referansı ve mutabakat durumu
- Append-only kayıt; düzeltme ters kayıtla yapılır

#### `payment_allocations`

Bir ödemenin bir veya birden fazla faturaya; bir faturanın da birden fazla ödemeye
dağıtılmasını sağlar. Fatura açık tutarı allocation toplamından hesaplanır.

#### Devam yapıları

- `invoice_orders`: aylık/konsolide fatura için Rechnung ↔ Auftrag çoktan çoğa ilişki.
- Fatura türü: `deposit | interim | final | standard`.
- `credit_notes` ve iptal/düzeltme zinciri.
- `invoice_reminders`: Mahnung seviyesi, gönderim ve ücret/faiz snapshot'ı.
- Ödeme planı ve müşteri portalı ödeme linki.

Uzun vadede Quittung ikinci bir gelir kaynağı gibi sayılmamalı; ödeme makbuzu olarak
`payment_id` ile ledger'a bağlanmalıdır. Dashboard geliri “ödenmiş fatura + Quittung”
toplayarak iki kez saymamalı, yalnızca posted payment toplamını kullanmalıdır.

### Faz 5 — Kalıcı müşteri portalı

Mevcut token sayfaları korunur. Portal bunların yerine tek seferde geçmez:

1. Magic-link ile müşteri hub'ı: aktif/eski teklifler, randevular, Aufträge, faturalar.
2. Adres/erişim bilgisi ve değişiklik talebi; kanonik kaydı doğrudan değiştirmek yerine
   firma onay kuyruğu.
3. Envanter/scope onayı, fotoğraf ve belge yükleme.
4. Nachtrag kabul/red.
5. Ödeme ve payment history.
6. Hasar/şikâyet/Nachreinigung dosyası ve mesajlaşma.

Portal token'ları veritabanında düz metin tutulmamalı; hash, expiry, single-use ve
revocation zorunludur. Müşteri portal auth'u firma çalışanlarının `company_members`
auth modeliyle karıştırılmamalıdır.

### Faz 6 — Servis tipine özel müşteri modülleri

#### Taşınma

- `move_scopes`, `move_scope_versions`
- Oda bazlı inventory, m³, ağır/hassas eşya
- Çoklu durak ve her durak için erişim/park bilgisi
- Dahil/hariç hizmetler ve müşteri onayı
- Depolama anlaşması ve süre
- İş öncesi/sonrası fotoğraf kanıtı
- İş tamamlanma müşteri onayı

Mevcut `offer_inventory_items` çöpe atılmaz; ilk migration bu kayıtları yeni scope
versiyonuna bağlayacak şekilde genişletir veya kontrollü olarak backfill eder.

#### Temizlik

- `service_locations`: objekt bilgisi, m², oda/zone, pencere/storen, erişim notu.
- `service_contracts`: başlangıç/bitiş, sıklık, fiyat, faturalama sıklığı, yenileme ve
  fesih tarihleri.
- `contract_scope_versions`: dahil/hariç hizmet ve Abnahme/SLA snapshot'ı.
- Planlanan ziyaretler mevcut `appointments` üzerinden yürür.
- Pause/skip ve hizmet değişikliği müşteri talebi olarak kaydedilir.

Unterhaltsreinigung sözleşme modeli yalnızca tekrarlayan hizmetler için kurulur.
Tek seferlik temizlik mevcut lead → offer → Auftrag akışında kalır.

#### Ortak case yönetimi

`customer_cases` ile `damage | complaint | recleaning | service_change` türleri,
durum, öncelik, kanıt dosyaları, iletişim ve çözüm sonucu tutulur. Ayrı ayrı dört
benzer tablo oluşturulmaz.

### Faz 7 — Birleşik iletişim ve lifecycle analytics

`inbound_emails` lead extraction kuyruğu olarak kalır. Shared inbox için ayrı katman:

- `communication_threads`
- `communication_messages`
- Mesajı customer/lead/offer/Auftrag/Rechnung'a bağlayan ilişkiler
- CRM içinden Edge Function üzerinden cevap
- Hazır cevap şablonları
- Okundu/cevapsız SLA bilgisi
- İlk sürüm e-posta; SMS/WhatsApp adapter'ları daha sonra

Mesaj içeriği saklanacaksa veri minimizasyonu, erişim rolleri ve retention politikası
önceden tanımlanmalıdır. Mevcut inbound akışının ham e-posta gövdesini saklamama kararı
shared inbox yapılırken fark edilmeden bozulmamalıdır.

## 5. KPI sözlüğü

Dashboard KPI'ları frontend'deki tablo sayımlarından değil, company-scoped SQL RPC'lerden
üretilmelidir. Her KPI için tarih kohortu ve payda açıkça tanımlanmalıdır.

| KPI | Projeye özel tanım |
|---|---|
| Lead → teklif | Dönemde oluşturulan qualified lead'lerden en az bir non-draft teklif serisi olanlar |
| Teklif → kabul | Dönemde ilk kez gönderilen teklif serilerinden herhangi bir versiyonu kabul edilenler |
| İlk cevap süresi | Lead `created_at` → ilk gerçek outbound iletişim veya teklif gönderimi |
| Teklif hazırlama | Lead `created_at` → teklif serisinin ilk `sent_at` zamanı |
| Görüntüleme → kabul | Kabul edilen versiyonun `viewed_at` → `accepted_at` süresi |
| Kayıp nedenleri | `lost_reason_code` dağılımı; serbest metin ana rapor alanı değildir |
| Ortalama müşteri değeri | Müşteri başına posted payment toplamı |
| LTV | Müşterinin bütün dönemlerdeki posted payment toplamı |
| Tekrar müşteri | Birden fazla won lead/işi olan müşteri oranı |
| Cross-sell | Ana servisle farklı servis türü alan müşteri oranı |
| Attach rate | Taşınma işleri içinde kutu/depolama/temizlik satın alanların oranı |
| Açık alacak | Issued ve iptal edilmemiş faturalar − payment allocations |
| Tahsilat süresi | Fatura tarihi → tamamen allocate edildiği tarih |
| Şikâyet/hasar | Tamamlanan Auftrag başına ilgili case oranı |
| Nachreinigung | Tamamlanan temizlik işi başına recleaning case oranı |
| Review/referral | İstek gönderilen müşteriler içindeki doğrulanmış dönüşüm oranı |

Versiyonlu tekliflerde satır değil `offer_series_id` sayılmalıdır; aksi halde revizyon
yapılan işler dönüşüm oranını yapay biçimde düşürür.

## 6. Bilinçli kapsam dışı alanlar

- Bordro, çalışma saati ve çalışan maliyeti
- Gelişmiş vardiya/dispatch optimizasyonu
- GPS/araç takip ve rota optimizasyonu
- Depo/ERP stok muhasebesi
- Marketplace, lead satışı, token bakiyesi ve Stripe SaaS aboneliği
- İlk aşamada ayrı mikroservisler

Ekip ve araç bilgileri bir müşteriye verilen sözün parçası olduğu ölçüde Auftrag/takvimde
görülebilir; ürünün merkezi çalışan performansı değil müşteri ve gelir yaşam döngüsüdür.

## 7. Önerilen ilk teslim paketi

İlk geliştirme paketi yalnızca Faz 0 + Faz 1 olmalıdır:

1. Prod migration/baseline/CI doğrulaması.
2. Customer 360 migration ve backfill dry-run raporu.
3. `/firma/kunden` liste ve detay ekranı.
4. Lead oluştururken deterministik customer resolution.
5. Teklif, Auftrag, randevu, fatura ve e-posta kayıtlarının müşteri kartında görünmesi.
6. Duplicate review/merge ve RLS testleri.

Bu paket tamamlanmadan portal, WhatsApp veya sözleşme modülüne başlanmamalıdır. Çünkü
hepsinin güvenilir biçimde bağlanacağı kanonik `customer_id` henüz yoktur.
