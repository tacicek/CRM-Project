# CRM / çoklu firma — uygulama yol haritası
Bu dosya **tek kaynak**: sıradaki iş, önerilen model ve ilerleme burada tutulur.

## Nasıl kullanılır?
1. Her oturumda önce bu dosyayı oku (`CURRENT_STEP` + ilk işaretlenmemiş madde).
2. Kullanıcıya şunu söyle: **"Şu an Adım N: [başlık]. Lütfen [MODEL] modelini seç."**
3. İş bitince ilgili satırda `[ ]` → `[x]` yap ve gerekiyorsa `CURRENT_STEP` değerini artır.

---

## CURRENT_STEP
**9**

---

## Model Rehberi

| Etiket | Cursor Modeli | Ne zaman kullan |
|--------|--------------|-----------------|
| 🟢 Fast | Composer 2 Fast | Basit düzeltme, rename, metin değişikliği |
| 🔵 Sonnet | Sonnet 4.6 Medium | Standart logic, edge fn, RLS, tek dosya |
| 🟣 GPT | GPT-5.5 Medium | UI metin, Helmet, meta, küçük UI fix |
| 🟡 Kimi | moonshot/kimi-k2.6 | Çok dosyalı frontend refactor — en iyi fiyat/perf |
| 🟠 DeepSeek | deepseek/deepseek-v4-pro | Büyük codebase, çapraz akış analizi, 1M context |
| 🔴 Opus | Opus 4.7 Extra High | Güvenlik audit, kritik mimari karar |
| ⚪ MiMo | xiaomi/mimo-v2-pro | Deney — Cursor'da reasoning sorunu var, dikkatli kullan |
| ⚫ MiniMax | minimax/minimax-m2.7 | Deney — prod'da henüz güvenilir değil |

---

## Adım listesi (sırayla)

| # | Durum | İş | Model |
|---|-------|----|-------|
| 1 | [x] | **Anfragen / lead kabul tutarlılığı:** `setTokenBalance` kaldır veya state geri ekle; `send-token-notification` ve token yanıtı ile uyum; kabul akışının runtime hatasız çalışması | 🔵 Sonnet 4.6 Medium |
| 2 | [x] | **Offerio kalıntıları (hızlı UI/metin):** `index.html` meta/title, `Leistungskatalog` Helmet, `Einstellungen` noreply metni, public logo referansları | 🟣 GPT-5.5 Medium |
| 3 | [x] | **Edge + e-posta tabanlı Offerio:** `send-offer` ve sık kullanılan function'larda `dash.offerio.ch` / `offerio.ch` → env (`SITE_URL`, `DASH_APP_URL`); from adresleri | 🔵 Sonnet 4.6 Medium |
| 4 | [x] | **`company_members` tablosu + backfill** (`companies.user_id` → üyelik satırı) | 🔵 Sonnet 4.6 Medium |
| 5 | [x] | **RLS:** `companies.user_id = auth.uid()` politikalarını üyelik alt sorgusuna geçir (geniş değişiklik) | 🟡 Kimi K2.6 |
| 6 | [x] | **Frontend:** `useActiveCompany`, cache key firma bazlı, `FirmaLayout` firma seçici, `fetchCompanyByIdForUser` + `useCachedCompany` hizalama | 🔵 Sonnet 4.6 Medium |
| 7 | [x] | **Edge Functions:** body'de gelen `company_id` için JWT kullanıcısının üyeliği doğrulama | 🔵 Sonnet 4.6 Medium |
| 8 | [x] | **Üyelik kilidi:** `company_members` INSERT/DELETE → sadece `service_role`; `admin-add/remove-company-member` edge fn; admin UI `CompanyMembersDialog` | 🔵 Sonnet 4.6 Medium |
| 9-old | [ ] | **İsteğe bağlı — lead modeli:** `lead_distributions` / `accept-lead` sadeleştirme veya tekil tenant akışı | 🟠 DeepSeek V4-Pro |
| 9 | [ ] | **İsteğe bağlı — kritik:** Stripe + RLS güvenlik audit, prod öncesi review | 🔴 Opus 4.7 Extra High |

---

## Notlar
- **Adım 5'ten itibaren Kimi K2.6** — MiMo'nun Cursor'da reasoning hatası verdiği bizzat gözlemlendi, bu yüzden çok dosyalı işlerde Kimi tercih edildi.
- **Adım 8'de DeepSeek V4-Pro** — `accept-lead` akışı büyük ve çapraz dosya analizi gerektiriyor, 1M context avantajlı.
- **Adım 9 asla ucuz modele verilmez** — Stripe + RLS kombinasyonu production güvenlik riskidir.
- MiMo ve MiniMax şimdilik **deney/test** statüsünde — stabil Cursor entegrasyonu için bekle.
- `model-routing.mdc` ile çelişirse bu tablodaki **Model** sütunu bu proje için geçerlidir.

---

## Geçmiş (manuel)

| Tarih | Ne yapıldı |
|--------|------------|
| 2026-05-14 | Model listesi güncellendi: Kimi K2.6, DeepSeek V4-Pro, MiMo, MiniMax eklendi; MiMo reasoning sorunu not edildi |