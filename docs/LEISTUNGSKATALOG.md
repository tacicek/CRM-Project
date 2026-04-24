# Leistungskatalog (Service Catalog)

## Overview

**Leistungskatalog** (Almanca: "Service Catalog"), firmalarin sundugu tuem hizmetleri ve bu hizmetlerin fiyatlandirmasini yoenetebilecekleri merkezi bir moduelduer. Bu moduel, teklif olustururken kullanilacak standart hizmet oegelerini tanimlamaniza olanak tanir.

## Ana Propertyler

### 1. Service Oegeleri (Service Items)
Firmanizin sundugu her bir hizmeti ayri ayri tanimlayabilirsiniz:

| Alan | Description |
|------|----------|
| **Service Tuerue** | Umzug (Moving), Reinigung (Temizlik), Räumung (Clearance), Entsorgung (Bertaraf), Lagerung (Storage), Klaviertransport (Piyano Tasima), Moebellift (Mobilya Liftue) |
| **Kategori** | Transport, Personal, Verpackung, Entsorgung, Reinigung, Versicherung, Lagerung, Spezial |
| **Isim** | Servicein adi |
| **Description** | Servicein detayli aciklamasi |
| **Birim** | Pauschal (Goetuerue), Stunde (Saat), m³, m², Zimmer (Oda), Stueck (Adet), kg, km, Tag (Guen), Inklusiv (Dahil) |
| **Varsayilan Fiyat** | CHF cinsinden fiyat |
| **Varsayilan Dahil** | Tekliflerde otomatik olarak dahil edilsin mi? |
| **Optional** | Muesterinin secebilecegi ekstra hizmet mi? |

### 2. Oenceden Tanimlanmis Sablonlar
Sistem, hizli baslangic icin hazir sablonlar sunar:

- **Standard Umzug** - Temel tasinma hizmetleri
- **Komplett Reinigung** - Kapsamli temizlik hizmetleri (garanti ile)
- **Standard Räumung** - Ev/daire bosaltma hizmetleri
- **Standard Entsorgung** - Profesyonel bertaraf hizmetleri
- **Standard Lagerung** - Guevenli depolama coezuemleri
- **Standard Klaviertransport** - Piyano/kuyruklu piyano tasima
- **Standard Moebellift** - Mobilya asansoerue hizmeti

### 3. Leistungsuebersicht Sablonlari
Tekliflerde kullanilacak hizmet paketleri olusturabilirsiniz:
- Hangi hizmetlerin dahil oldugu
- Hangi hizmetlerin haric tutuldugu
- Oezel notlar

## Kullanim Senaryolari

### Senaryo 1: Yeni Service Ekleme
1. "Leistungskatalog" sayfasina gidin
2. Ilgili hizmet tueruenue secin (oern: Umzug)
3. "+" butonuna tiklayin
4. Service detaylarini girin
5. Kaydedin

### Senaryo 2: Sablon Kullanma
1. "Vorlage laden" (Sablon Yuekle) butonuna tiklayin
2. Hazir sablonlardan birini secin
3. Tuem hizmetler otomatik olarak olusturulur
4. Ihtiyaca goere duezenleyin

### Senaryo 3: Teklif Olustururken
Teklif olustururken, Leistungskatalog'daki hizmetler otomatik olarak kullanilabilir:
- Dahil edilen hizmetler otomatik eklenir
- Optional hizmetler secilebilir
- Fiyatlar otomatik hesaplanir

## Veritabani Yapisi

### company_service_items Tablosu
```sql
- id: UUID (Benzersiz kimlik)
- company_id: UUID (Firma kimligi)
- service_type: VARCHAR (Service tuerue)
- category: VARCHAR (Kategori)
- name: VARCHAR (Service adi)
- description: TEXT (Description)
- unit: VARCHAR (Birim)
- default_price: NUMERIC (Varsayilan fiyat)
- is_default_included: BOOLEAN (Varsayilan dahil mi?)
- is_optional: BOOLEAN (Optional mi?)
- display_order: INTEGER (Goeruentueleme sirasi)
```

### leistungsuebersicht_templates Tablosu
```sql
- id: UUID (Benzersiz kimlik)
- company_id: UUID (Firma kimligi)
- service_type: VARCHAR (Service tuerue)
- name: VARCHAR (Sablon adi)
- description: TEXT (Description)
- included_service_ids: UUID[] (Dahil edilen hizmet kimlikleri)
- excluded_services: TEXT[] (Haric tutulan hizmetler)
- notes: TEXT (Notlar)
- is_active: BOOLEAN (Aktif mi?)
```

## Service Tuerleri ve Kategorileri

### Service Tuerleri (Service Types)
| Kod | Almanca | Tuerkce |
|-----|---------|--------|
| umzug | Umzug | Moving |
| reinigung | Reinigung | Temizlik |
| raeumung | Räumung | Clearance |
| entsorgung | Entsorgung | Bertaraf |
| lagerung | Lagerung | Storage |
| klaviertransport | Klaviertransport | Piyano Tasima |
| moebellift | Moebellift | Mobilya Liftue |

### Kategoriler (Categories)
| Kod | Almanca | Tuerkce |
|-----|---------|--------|
| transport | Transport | Tasima |
| personal | Personal | Personel |
| verpackung | Verpackung | Paketleme |
| entsorgung | Entsorgung | Bertaraf |
| reinigung | Reinigung | Temizlik |
| versicherung | Versicherung | Sigorta |
| lagerung | Lagerung | Storage |
| spezial | Spezialleistungen | Oezel Serviceler |

### Birimler (Units)
| Kod | Almanca | Tuerkce |
|-----|---------|--------|
| Pauschal | Pauschal | Goetuerue |
| Stunde | pro Stunde | Saat basi |
| m3 | pro m³ | m³ basina |
| m2 | pro m² | m² basina |
| Zimmer | pro Zimmer | Oda basina |
| Stueck | pro Stueck | Adet basina |
| kg | pro kg | kg basina |
| km | pro Kilometer | km basina |
| Tag | pro Tag | Guen basina |
| Inklusiv | Inklusiv | Dahil |

## Avantajlar

1. **Zaman Tasarrufu**: Tekliflerde ayni hizmetleri tekrar tekrar yazmak yerine, hazir listeden secin
2. **Tutarlilik**: Tuem tekliflerde ayni fiyatlandirma ve aciklamalar
3. **Profesyonellik**: Detayli hizmet aciklamalari ile customerlere profesyonel goeruenuem
4. **Esneklik**: Her teklif icin hizmetleri oezellestirme imkani
5. **Sablonlar**: Hazir sablonlar ile hizli baslangic

## Entegrasyon

Leistungskatalog asagidaki moduellerle entegre calisir:

- **Offerte (Teklif)**: Teklif olustururken hizmetler buradan cekilir
- **Leistungsuebersicht**: Teklife eklenecek hizmet oezeti
- **Checkliste**: Service kontrol listeleri
- **PDF Olusturma**: Teklif PDF'lerinde hizmet listesi

## Ipuclari

1. **Fiyatlari guencel tutun**: Maliyetler degistiginde katalogdaki fiyatlari guencelleyin
2. **Detayli aciklamalar yazin**: Muesteriler neyi satin aldiklarini bilmeli
3. **Kategorileri dogru kullanin**: Servicelerin bulunmasini kolaylastirir
4. **Optional hizmetleri belirleyin**: Muesterilere ek satis firsati sunar
5. **Sablonlari oezellestirin**: Hazir sablonlari firmaniza goere duezenleyin
