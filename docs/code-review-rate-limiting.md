# Code Review: Rate Limiting Implementation

## 🔴 KRITIK SORUNLAR

### 1. **Memory Leak - Map Bueyuemesi**
```typescript
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
```

**Sorun:**
- Map hic temizlenmiyor
- Her yeni email/leadId icin entry ekleniyor
- Eski entry'ler sadece `resetTime` gectiginde override ediliyor
- **Milyonlarca farkli email ile Map sonsuz bueyueyebilir**

**Patlama Senaryosu:**
```
1000 farkli email → 1000 entry
10000 farkli email → 10000 entry
1000000 farkli email → Memory overflow 💥
```

**Coezuem:**
```typescript
// Eski entry'leri temizle
const cleanupOldEntries = () => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime + RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
};

// Her 1000 istekte bir temizle
let requestCount = 0;
if (++requestCount % 1000 === 0) {
  cleanupOldEntries();
}
```

---

### 2. **Race Condition - Concurrent Requests**
```typescript
const record = rateLimitMap.get(key);
if (!record || now > record.resetTime) {
  rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
  return false;
}
record.count++; // ⚠️ Race condition!
```

**Sorun:**
- Edge Functions paralel calisabilir
- Ayni anda 2 request gelirse:
  - Her ikisi de `count: 1` goeruer
  - Her ikisi de `count++` yapar
  - Sonuc: `count: 2` olmasi gerekirken `count: 1` kalir

**Patlama Senaryosu:**
```
Request A: get() → count: 1
Request B: get() → count: 1 (ayni anda)
Request A: count++ → count: 2
Request B: count++ → count: 2 (ama olmasi gereken 3!)
```

**Coezuem:**
```typescript
// Atomic increment kullan
const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  // Atomic: get → check → increment → set
  const newCount = record.count + 1;
  if (newCount > RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  rateLimitMap.set(key, { ...record, count: newCount });
  return false;
};
```

---

### 3. **In-Memory State - Multi-Instance Problem**

**Sorun:**
- Edge Functions **stateless** ve **multi-instance** calisir
- Her instance kendi Map'ine sahip
- Rate limiting **instance bazli**, global degil

**Patlama Senaryosu:**
```
Instance 1: email@test.com → 5 istek (limit)
Instance 2: email@test.com → 5 istek (limit) ✅ YENIDEN!
Instance 3: email@test.com → 5 istek (limit) ✅ YENIDEN!

Toplam: 15 istek (limit 5 olmasi gerekirken!)
```

**Coezuem:**
- Redis veya Supabase'de shared state kullan
- Veya IP-based rate limiting ekle

---

## 🟠 YUeKSEK OeNCELIKLI SORUNLAR

### 4. **Rate Limit Check Sirasi Yanlis**

```typescript
// ❌ YANLIS: Rate limit validation'dan SONRA
const data = parseResult.data;
if (isRateLimited(data.customerEmail)) {
  return 429;
}
```

**Sorun:**
- JSON parse ve validation **oence** yapiliyor
- Rate limit **sonra** kontrol ediliyor
- Saldirgan bueyuek JSON payload goendererek CPU'yu yorabilir

**Coezuem:**
```typescript
// ✅ DOGRU: Rate limit EN BASTA
const rawBody = await req.json();
const email = rawBody?.customerEmail;

if (!email || isRateLimited(email)) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
    status: 429,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

// Sonra validation
const parseResult = LeadConfirmationSchema.safeParse(rawBody);
```

---

### 5. **Email Validation Eksik**

```typescript
customerEmail: z.string().email("Ungueltige E-Mail-Addressse").max(255)
```

**Sorun:**
- Email formati kontrol ediliyor ama:
  - Disposable email kontrolue yok
  - Domain blacklist yok
  - Email reputation kontrolue yok

**Patlama Senaryosu:**
```
10minutemail.com → Spam icin kullanilabilir
tempmail.com → Spam icin kullanilabilir
```

**Coezuem:**
```typescript
const DISPOSABLE_EMAIL_DOMAINS = ['10minutemail.com', 'tempmail.com', ...];

customerEmail: z.string()
  .email()
  .max(255)
  .refine((email) => {
    const domain = email.split('@')[1]?.toLowerCase();
    return !DISPOSABLE_EMAIL_DOMAINS.includes(domain);
  }, "Disposable email addresses are not allowed")
```

---

### 6. **Error Handling Eksik**

```typescript
const emailResponse = await resend.emails.send({...});
console.log("Email sent successfully:", emailResponse);
```

**Sorun:**
- `resend.emails.send()` hata doenebilir
- Rate limit sayaci artirildi ama email goenderilemedi
- Kullanici tekrar deneyemez (rate limit'te)

**Patlama Senaryosu:**
```
1. Request → Rate limit count: 1
2. Email goender → Resend API hatasi
3. Kullanici tekrar dener → Rate limit count: 2
4. Email goender → Resend API hatasi
...
5. Rate limit → Kullanici bloke!
```

**Coezuem:**
```typescript
try {
  const emailResponse = await resend.emails.send({...});
  
  if (!emailResponse.data?.id) {
    // Email goenderilemedi, rate limit'i geri al
    const record = rateLimitMap.get(data.customerEmail.toLowerCase());
    if (record && record.count > 0) {
      record.count--;
    }
    throw new Error("Failed to send email");
  }
  
  await logEmail({...});
} catch (emailError) {
  // Rate limit'i geri al
  const record = rateLimitMap.get(data.customerEmail.toLowerCase());
  if (record && record.count > 0) {
    record.count--;
  }
  throw emailError;
}
```

---

## 🟡 ORTA OeNCELIKLI SORUNLAR

### 7. **Magic Numbers - Hardcoded Limits**

```typescript
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5;
```

**Sorun:**
- Limitler kod icinde hardcoded
- Degistirmek icin deploy gerekir
- Test etmek zor

**Coezuem:**
```typescript
const RATE_LIMIT_WINDOW_MS = parseInt(
  Deno.env.get("RATE_LIMIT_WINDOW_MS") || "60000"
);
const RATE_LIMIT_MAX_REQUESTS = parseInt(
  Deno.env.get("RATE_LIMIT_MAX_REQUESTS") || "5"
);
```

---

### 8. **Logging Eksik**

```typescript
if (isRateLimited(data.customerEmail)) {
  console.warn("Rate limit exceeded");
  return 429;
}
```

**Sorun:**
- Rate limit asildiginda sadece console.log
- Analytics yok
- Alerting yok
- Pattern detection yok

**Coezuem:**
```typescript
if (isRateLimited(data.customerEmail)) {
  // Log to Supabase for analytics
  await supabase.from('rate_limit_violations').insert({
    email: data.customerEmail,
    endpoint: 'send-lead-confirmation',
    timestamp: new Date().toISOString(),
    ip_address: req.headers.get('x-forwarded-for'),
  });
  
  // Alert if suspicious pattern
  const violations = await getRecentViolations(data.customerEmail);
  if (violations > 10) {
    await sendAlertToAdmin(data.customerEmail);
  }
  
  return 429;
}
```

---

### 9. **IP-Based Rate Limiting Yok**

**Sorun:**
- Sadece email bazli rate limiting var
- Ayni IP'den farkli emaillerle spam yapilabilir

**Coezuem:**
```typescript
const getClientIP = (req: Request): string => {
  return req.headers.get('x-forwarded-for')?.split(',')[0] || 
         req.headers.get('x-real-ip') || 
         'unknown';
};

const isIPRateLimited = (ip: string): boolean => {
  // IP bazli rate limiting
  return isRateLimited(`ip:${ip}`);
};

// Hem email hem IP kontrol et
if (isRateLimited(email) || isIPRateLimited(clientIP)) {
  return 429;
}
```

---

## ✅ IYILESTIRME OeNERILERI

### 10. **Sliding Window Rate Limiting**

**Mevcut:** Fixed window (1 dakika icinde 5 istek)

**Sorun:**
```
00:00 → 5 istek ✅
00:59 → 5 istek ✅
01:00 → 5 istek ✅ (Yeni window basladi)
```

**Daha Iyi:** Sliding window
```typescript
interface RateLimitRecord {
  requests: number[]; // Timestamp array
  resetTime: number;
}

const isRateLimitedSliding = (key: string): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record) {
    rateLimitMap.set(key, { requests: [now], resetTime: now + WINDOW_MS });
    return false;
  }
  
  // Eski request'leri temizle
  const recentRequests = record.requests.filter(
    ts => now - ts < RATE_LIMIT_WINDOW_MS
  );
  
  if (recentRequests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  
  recentRequests.push(now);
  rateLimitMap.set(key, { requests: recentRequests, resetTime: now + WINDOW_MS });
  return false;
};
```

---

### 11. **Exponential Backoff**

**Mevcut:** Sabit 429 error

**Daha Iyi:** Retry-After header
```typescript
if (isRateLimited(email)) {
  const record = rateLimitMap.get(email.toLowerCase());
  const retryAfter = record 
    ? Math.ceil((record.resetTime - Date.now()) / 1000)
    : 60;
  
  return new Response(
    JSON.stringify({ error: "Rate limit exceeded" }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        ...corsHeaders
      }
    }
  );
}
```

---

## 📊 OeNCELIK SIRASI

| Sorun | Oencelik | Risk | Coezuem Zorlugu |
|-------|---------|------|---------------|
| Memory Leak | 🔴 Kritik | Yueksek | Kolay |
| Race Condition | 🔴 Kritik | Yueksek | Orta |
| Multi-Instance | 🔴 Kritik | Yueksek | Zor |
| Rate Limit Sirasi | 🟠 Yueksek | Orta | Kolay |
| Email Validation | 🟠 Yueksek | Orta | Kolay |
| Error Handling | 🟠 Yueksek | Orta | Kolay |
| Magic Numbers | 🟡 Orta | Duesuek | Kolay |
| Logging | 🟡 Orta | Duesuek | Orta |
| IP Rate Limiting | 🟡 Orta | Orta | Orta |
| Sliding Window | 🟢 Duesuek | Duesuek | Zor |

---

## 🎯 OeNERILEN DUeZELTMELER (Hemen Yapilmali)

1. ✅ Memory cleanup mekanizmasi ekle
2. ✅ Rate limit kontroluenue validation'dan OeNCE yap
3. ✅ Email goenderme hatasi durumunda rate limit'i geri al
4. ✅ IP-based rate limiting ekle
5. ✅ Retry-After header ekle
