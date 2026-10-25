# Quittung başlangıç adresindeki eksik bina numarası

26 Ekim 2026; üretimde yalnız okuma. Kullanıcı eksikliğin müşteri/başlangıç adresinde olduğunu bildirdi; hangi makbuz olduğunu henüz belirtmedi. Hiçbir makbuz, adres, imza veya PDF arşivi değiştirilmedi. Toplu veri düzeltmesi hazırlanmadı veya uygulanmadı.

Eski `QuittungDetail.tsx` teklif seçimi ev numarası alanını sorgulamıyor, başlangıç adresini yalnız sokak + posta kodu/şehir ile birleştiriyordu. Bu yol `1f7f8551b44e0af56076132d43658114217912bf` commit'inin 263 ve 298. satırlarında görülebilir. Dolayısıyla numara daha PDF çizilmeden kalıcı `quittungen.customer_address` alanından kaybolabiliyordu. Yeni kaynak dönüştürücüsünü düzeltmek, önceden kaydedilmiş veya imzalanmış adresi kendiliğinden değiştirmez.

[Üretim sinyali](production-origin-signal.json) ve [tekrarlanabilir salt-okuma sorgusu](production-origin-readonly.sql) şu durumu doğruladı:

| Ölçüm | Sonuç |
| --- | ---: |
| Makbuz / taslak / düzenlenmiş belge | 26 / 20 / 6 |
| Auftrag bağlantısı taşıyan makbuz | 0 |
| Adresi, numarasız eski birleştiricinin ham çıktısıyla tam eşleşen; teklif kaynağı daha eski taslak | 8 |
| Aynı firma/teklif/müşteri bağlantısı ve bütün ek koşulları sağlayan taslak | 7 |
| Farklı müşteri kimliği nedeniyle dışlanan taslak | 1 |
| Eski numarasız kalıpla tam eşleşen düzenlenmiş belge | 2 |
| Bu iki belgeden PDF arşivi bulunan / imzası bulunan | 1 / 2 |
| Bu iki belgeden teklif adresi makbuzdan sonra dondurulmuş olan | 1 |

Yedi tanı adayının tamamı sürüm 2, `draft`, `issued_at` boş; imza ve imza zamanları, firma snapshot'ı, Auftrag bağlantısı, belge arşivi ve gönderim kaydı yok. Teklifin dondurma, oluşturma ve son güncelleme zamanları makbuzun oluşturulmasından önce. Firma/teklif/müşteri bağlantısı aynı. Bu, otomatik düzeltme yapıldığı veya hedef belgenin bu yediden biri olduğu anlamına gelmez. Sekizinci taslağın iki müşteri kimliği de dolu ve birbirinden farklıdır; kimlik değiştirilerek eşleştirilmemelidir.

Karşılaştırma ham metne eşitlik kullanır; boşluk, virgül veya elle yazılmış adres dönüştürülmez. Numaranın metinde geçmesine bakmak güvenilir değildir: aynı rakam posta kodunda da bulunabilir. Hedef/varış adresi bu çalışmada hiçbir düzeltme kapsamına alınmadı.

İmzası veya arşivi olan iki belge aday listesine alınmadı. Birinde kaynak daha önce dondurulmuş olsa da mevcut imzalı PDF değiştirilemez; diğerinde kaynak makbuzdan sonra değiştiği için bugünkü kaynak tarihsel doğruluğu ayrıca kanıtlamaz. İlgili makbuz kullanıcı tarafından belirlendikten sonra, gerekiyorsa eski belge ve imzaları koruyan açık bir düzeltme akışı değerlendirilmelidir.

Firma adresi ayrı bir bulgudur: iki güncel firma profilinde bina numarası var; altı eski düzenlenmiş belgenin firma snapshot'ında `house_number` anahtarı yok. Bu, kullanıcının belirttiği müşteri/başlangıç adresinin kaynağı değildir ve güncel firma alanlarını eski snapshot'a eklemek için gerekçe oluşturmaz.

Kanıt dosyaları yalnız toplamlar ve boolean sonuçlar içerir; müşteri adı, adres, kimlik, imza, nesne yolu, erişim anahtarı veya bağlantı token'ı kaydedilmedi. Üretim sorguları kimliği doğrulanmış hedefte, `scripts/prod-readonly.sh` koruması ve `ssh -F /dev/null` ile yürütüldü. Bu çalışma veri onarımı içermediğinden yazma işlemi veya yerel onarım testi çalıştırılmadı. Kaynak kod düzeltmesinin test/deploy kanıtları rollout dizininde ayrı tutulur.
