# Quittung inceleme kanıtları — 25 Ekim 2026

Ana rapor: [Quittung inceleme raporu](../../QUITTUNG_INCELEME_RAPORU_2026-10-25.md).

Bu klasör yalnız anonim örnekler ve teşhis araçları içerir. Üretim müşterisi, gerçek imza veya erişim anahtarı içermez. Uygulama koduna ve DB'ye yazmaz; gerçek e-posta göndermez. Betikler repo kökünden çalıştırılmalıdır. Node bağımlılıkları mevcut `node_modules` üzerinden, tarayıcı Playwright'ın yerel Chromium kurulumu üzerinden kullanılır. PDF metin kontrolü için `pdftotext` gerekir.

## Kanıt türleri

- `browser-results.json`: gerçek QuittungDetail + SignaturePad UI olayları. Supabase, şirket/auth ve PDF taşıma adaptörleri sahte. PDF içeriğine verilen veri yakalanır; bu araç PDF renderer testi değildir.
- `flow-results.jsonl`: gerçek kaynak fonksiyonlarından çıkarılmış sipariş aktarımı ve hesaplama sonuçları. `FAIL` işaretleri mevcut sorunu yakalar; bunlar CI başarısı anlamına gelmez.
- `send-results.jsonl`: gerçek Edge handler'ın sahte dış adaptörlerle kontrol akışı. Gönderim sayısı gerçek mail değil, adaptör çağrısı sayısıdır.
- `pdf-checks.json`: gerçek renderer çıktılarındaki seçili içerik, sayfa bölünmesi ve saat dilimi gözlemleri. Tam bir PDF uygunluk testi değildir.
- `signature-repro.json`: bitmap imzanın vektör temelli resize sırasında görünümden silinmesi. DB/PDF imzasının silindiğini göstermez.
- 14 PDF: dört durum, imzalı/ödenmiş imzalı, FR/EN, Türkçe karakter, uzun kalemler/alanlar, %0 vergi ve iki ek saat dilimi.
- PNG'ler: rapora bağlı seçili görseller ve sentetik imza kaynağı.

**Önemli:** `signed-save-draft` browser senaryosunda sahte DB yazmayı kabul eder. Gerçek SQL `guard_quittung_status_regression` bunu reddeder. Sonuç yalnız UI'ın geçersiz bir eylem sunduğunu kanıtlar; DB kilidinin aşılması değildir. Ham koşucu çıktısında bu sınır ayrıca belirtilir.

## Yeniden üretim

Çıktılar `/tmp/quittung-audit` ve `/tmp/quittung-pdf-audit` altına yazılır. Aşağıdaki komutlar mevcut kaynakları tekrar okur; kaynak değiştiyse rapor tarihindeki sonuçlardan farklı sonuç beklenir.

```bash
mkdir -p /tmp/quittung-audit /tmp/quittung-pdf-audit
node docs/audits/quittung-2026-10-25/browser-build.mjs
node docs/audits/quittung-2026-10-25/browser-run.mjs
node docs/audits/quittung-2026-10-25/flow-repro.cjs
node docs/audits/quittung-2026-10-25/send-repro.cjs
node docs/audits/quittung-2026-10-25/signature-repro.mjs
TZ=Asia/Bangkok node --loader ./docs/audits/quittung-2026-10-25/pdf-loader.mjs docs/audits/quittung-2026-10-25/render-pdf.tsx
TZ=Europe/Zurich AUDIT_CASE=signed-image AUDIT_SUFFIX=-zurich node --loader ./docs/audits/quittung-2026-10-25/pdf-loader.mjs docs/audits/quittung-2026-10-25/render-pdf.tsx
TZ=America/Los_Angeles AUDIT_CASE=signed-image AUDIT_SUFFIX=-la node --loader ./docs/audits/quittung-2026-10-25/pdf-loader.mjs docs/audits/quittung-2026-10-25/render-pdf.tsx
python3 docs/audits/quittung-2026-10-25/check-pdfs.py
```

UI koşucusu bazı bağımlılıkları değiştirdiği için tam uygulama/üretim uçtan uca testi değildir. PDF koşucusu gerçek şablonu ve gerçek renderer'ı kullanır; logo ağ/CORS akışı ve gerçek müşteri içeriği denenmemiştir. SQL bulgularının kapsamı ve üretim doğrulama sınırları ana raporda belirtilmiştir.

## Mevcut proje kontrolleri

Denetim sırasında mevcut test paketi 115 dosya / 2.177 test ile geçti. Frontend tip kontrolü başarılı. İncelenen frontend dosyalarında lint hatası yok. Edge `send-quittung` normal ESLint ayarında hariç tutulduğu için Edge lint veya Deno type-check başarısı iddia edilmiyor. Hesap/handler/UI koşucuları mevcut kullanıcı akışlarını incelemek için hazırlanmış geçici teşhis araçlarının rapor ekleridir; ürün test paketi değiştirilmedi.
