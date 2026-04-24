# Hetzner IP Unblock Request

**Betreff:** IP-Freischaltungsanfrage - Server #116567210 ([SERVER_IP])

---

**Sehr geehrte Hetzner Support-Mitarbeiter,**

ich wende mich an Sie, um eine Freischaltung meines Server-IPs zu beantragen, nachdem ich die Ursache des Problems identifiziert und behoben habe.

**Server-Informationen:**
- Server-ID: #116567210
- Server-Name: coolify-ubuntu-16gb-nbg1-1
- IP-Addressse: [SERVER_IP]
- IPv6: 2a01:4f8:1c1f:8fbe::/64

**Problem-Ursache:**

Nach einer umfassenden Sicherheitsanalyse habe ich festgestellt, dass eine oeffentlich zugängliche E-Mail-Funktion in meiner Anwendung missbraucht wurde. Die Funktion `send-lead-confirmation` hatte keine Rate-Limiting-Mechanismen implementiert, was es Angreifern ermoeglichte, diese Endpoint fuer Spam-E-Mails zu missbrauchen.

**Durchgefuehrte Maßnahmen:**

1. **Rate Limiting implementiert:**
   - `send-lead-confirmation`: Maximal 5 E-Mails pro Minute pro E-Mail-Addressse
   - `notify-companies`: Maximal 2 Benachrichtigungen pro 5 Minuten pro Lead-ID
   - Automatische Blockierung bei Ueberschreitung der Limits (HTTP 429)

2. **Sicherheitsueberpruefung:**
   - Alle oeffentlich zugänglichen E-Mail-Endpoints ueberprueft
   - Rate-Limiting-Mechanismen fuer kritische Funktionen hinzugefuegt
   - Monitoring-Systeme implementiert

3. **Code-Änderungen:**
   - Rate-Limiting-Logik in betroffenen Edge Functions hinzugefuegt
   - In-Memory-Rate-Limiting mit automatischem Reset nach Zeitfenster
   - Fehlerbehandlung fuer Rate-Limit-Ueberschreitungen

**Zusätzliche Sicherheitsmaßnahmen:**

- Regelmäßige Ueberwachung der Edge Function Logs
- Automatische Erkennung von anomalen Aktivitätsmustern
- Bereitschaft zur weiteren Sicherheitshärtung bei Bedarf

**Zusicherung:**

Ich versichere, dass:
- Die Sicherheitsluecke vollständig geschlossen wurde
- Ähnliche Probleme in Zukunft durch Rate-Limiting verhindert werden
- Ich die Hetzner Nutzungsbedingungen einhalten werde
- Ich proaktive Maßnahmen ergreife, um Missbrauch zu verhindern

**Bitte um Freischaltung:**

Ich bitte Sie hoeflich, die IP-Addressse [SERVER_IP] wieder freizuschalten. Die Ursache wurde behoben und ich habe Maßnahmen ergriffen, um eine Wiederholung zu verhindern.

Falls Sie weitere Informationen oder Nachweise benoetigen, stehe ich gerne zur Verfuegung.

Mit freundlichen Grueßen,

[NAME]
[Ihre Kontaktdaten]

---

**English Version:**

**Subject:** IP Unblock Request - Server #116567210 ([SERVER_IP])

Dear Hetzner Support Team,

I am writing to request the unblocking of my server IP address after identifying and resolving the root cause of the issue.

**Server Information:**
- Server ID: #116567210
- Server Name: coolify-ubuntu-16gb-nbg1-1
- IP Address: [SERVER_IP]
- IPv6: 2a01:4f8:1c1f:8fbe::/64

**Root Cause:**

After conducting a comprehensive security audit, I identified that a publicly accessible email function in my application was being abused. The `send-lead-confirmation` endpoint lacked rate limiting mechanisms, which allowed attackers to abuse this endpoint for spam emails.

**Actions Taken:**

1. **Implemented Rate Limiting:**
   - `send-lead-confirmation`: Maximum 5 emails per minute per email address
   - `notify-companies`: Maximum 2 notifications per 5 minutes per lead ID
   - Automatic blocking when limits are exceeded (HTTP 429)

2. **Security Review:**
   - Reviewed all publicly accessible email endpoints
   - Added rate limiting mechanisms for critical functions
   - Implemented monitoring systems

3. **Code Changes:**
   - Added rate limiting logic to affected Edge Functions
   - In-memory rate limiting with automatic reset after time window
   - Error handling for rate limit exceedances

**Additional Security Measures:**

- Regular monitoring of Edge Function logs
- Automatic detection of anomalous activity patterns
- Preparedness for further security hardening if needed

**Assurance:**

I assure you that:
- The security vulnerability has been completely closed
- Similar issues will be prevented in the future through rate limiting
- I will comply with Hetzner's terms of service
- I am taking proactive measures to prevent abuse

**Request for Unblocking:**

I respectfully request that IP address [SERVER_IP] be unblocked. The root cause has been resolved and I have taken measures to prevent recurrence.

If you require any additional information or evidence, I am happy to provide it.

Best regards,

[NAME]
[Your Contact Information]
