    # Räumung Anfrage-Formular — Bestandsaufnahme

    > **Route:** `/anfrage/raeumung`  
    > **Dateien:** `src/components/raeumung/RaeumungWizard.tsx` + `src/components/raeumung/steps/Step1–10.tsx`  
    > **Gesamtschritte:** 9 oder 10 (je nach Räumungsart)  
    > **Status:** Zu überarbeiten

    ---

    ## Problem (Kundenfeedback)

    Formular zu lang und komplex. Der Zustandsbewertungsschritt (Schritt 6) ist für viele verwirrend.

    ---

    ## Aktuelle Formular-Struktur (9–10 Schritte)

    ---

    ### Schritt 1 — Räumungsart

    **Titel:** „Welche Art von Räumung benötigen Sie?"

    | Feld | Typ | Optionen |
    |------|-----|---------|
    | Räumungsart | Card-Auswahl (Pflicht) | Wohnungsräumung / Hausräumung / Kellerräumung / Dachbodenräumung / Büroräumung / Zwangsräumung |

    **Logik:** Bei `forced_eviction` (Zwangsräumung) → Gerichtsbefehl-Bestätigung erforderlich (Schritt 10)

    ---

    ### Schritt 2 — Objektdetails

    **Titel:** „Details zum zu räumenden Objekt"

    | Feld | Typ | Pflicht |
    |------|-----|---------|
    | Objekttyp | Card-Auswahl | Ja |
    | Fläche m² | Zahl-Eingabe | Ja |
    | Zimmeranzahl | Zahl / Counter | Nein |

    **Objekttypen:** Wohnung / Haus / WG-Zimmer / Keller / Dachboden / Büro / Lager / Sonstiges

    ---

    ### Schritt 3 — Adresse

    **Titel:** „Adresse des zu räumenden Objekts"

    | Feld | Typ | Pflicht |
    |------|-----|---------|
    | Strasse | Texteingabe | Ja |
    | Hausnummer | Texteingabe | Nein |
    | PLZ | Texteingabe | Ja |
    | Ort | Texteingabe | Ja |

    ---

    ### Schritt 4 — Zugang & Zugänglichkeit

    **Titel:** „Wie gut ist das Objekt zugänglich?"

    | Feld | Typ | Pflicht |
    |------|-----|---------|
    | Stockwerk | Card-Auswahl | Ja |
    | Lift vorhanden? | Ja/Nein | Nein |
    | Lifttyp | Auswahl (wenn Lift = Ja) | Nein |
    | Parkplatz-Distanz m | Slider | Nein |

    ---

    ### Schritt 5 — Umfang der Räumung

    **Titel:** „Welchen Umfang hat die Räumung?"

    | Feld | Typ | Optionen |
    |------|-----|---------|
    | Umfang | Card-Auswahl (Pflicht) | Vollständige Räumung / Teilräumung / Nur schwere Gegenstände / Nur Sperrmüll |
    | Füllgrad % | Slider | 0–100% wie voll ist das Objekt |
    | Schwere Gegenstände | Checkboxen | Klavier / Tresor / etc. |
    | Sonstige Hinweise | Textarea | Nein |

    ---

    ### Schritt 6 — Zustandsbewertung *(nur bei bestimmten Räumungsarten)*

    **Titel:** „Zustand des Objekts"

    > Wird **nur angezeigt** bei: Zwangsräumung, Wohnungsräumung mit besonderen Umständen

    | Feld | Typ | Optionen |
    |------|-----|---------|
    | Allgemeiner Zustand | Card-Auswahl (Pflicht) | Normal / Vernachlässigt / Stark vernachlässigt |
    | Besonderheiten | Checkboxen (mehrere möglich) | Müllberge / Ungeziefer / Schimmel / Geruch / Gesundheitsgefahr / Tierkot / Bauliche Schäden |
    | Füllgrad | Slider | 0–100% |
    | Schutzausrüstung nötig? | Auswahl | Sicher / Unsicher / Gefährlich |

    ---

    ### Schritt 7 — Zusatzleistungen

    **Titel:** „Optionale Zusatzleistungen"

    | Service | Typ | Details |
    |---------|-----|---------|
    | Endreinigung | Toggle | — |
    | Entsorgung | Toggle | inkl. Volumen |
    | Wiederverkauf von Gegenständen | Toggle | — |
    | Schlüsselübergabe | Toggle | — |

    ---

    ### Schritt 8 — Zeitplanung

    **Titel:** „Wann soll die Räumung stattfinden?"

    | Feld | Typ | Pflicht |
    |------|-----|---------|
    | Wunschdatum | Datepicker | Ja |
    | Flexibilität | Cards | Fest / ±3 Tage / ±1 Woche / Flexibel |
    | Dringlichkeit | Auswahl | Normal / Dringend / Sehr dringend |

    ---

    ### Schritt 9 — Kontaktdaten

    **Titel:** „Ihre Kontaktdaten"

    | Feld | Typ | Pflicht |
    |------|-----|---------|
    | Anrede | Buttons | Ja |
    | Vorname | Texteingabe | Ja |
    | Nachname | Texteingabe | Ja |
    | E-Mail | E-Mail-Eingabe | Ja |
    | Telefon | Tel-Eingabe | Ja |
    | Bevorzugte Kontaktzeit | Dropdown | Nein |

    ---

    ### Schritt 10 — Zusammenfassung & AGB

    **Titel:** „Zusammenfassung"

    | Element | Details |
    |---------|---------|
    | Übersicht aller Angaben | Mit Bearbeiten-Buttons |
    | Anzahl Offerten | 1 / 3 / 5 |
    | Bemerkungen | Textarea (optional) |
    | AGB akzeptieren | Checkbox (Pflicht) |
    | Berechtigung bestätigen | Checkbox (Pflicht) — Ich bin berechtigt, diese Räumung zu beauftragen |
    | Gerichtsbefehl vorhanden | Checkbox (Pflicht nur bei Zwangsräumung) |

    ---

    ## Probleme & Verbesserungspotenzial

    ### ❌ Hauptprobleme

    1. **10 Schritte ist sehr lang** für eine Räumungsanfrage
    2. **Zustandsbewertung (Schritt 6)** — sehr detailliert, überfordert Normalnutzer
    3. **Füllgrad-Slider** — Nutzer können das nicht einschätzen
    4. **Schutzausrüstung-Abfrage** — sollte intern entschieden werden
    5. **Zwangsräumung als öffentliche Option** — erfordert spezielle Behandlung
    6. **Zugänglichkeit/Zugang** hat dieselben Fragen wie Umzug → redundant

    ### 💡 Vorschlag für Neugestaltung

    - **Ziel: 5–6 Schritte**
    - Schritt 1: Räumungsart + Objekttyp
    - Schritt 2: Grösse + Adresse
    - Schritt 3: Umfang (grob: Klein / Mittel / Gross / Komplett)
    - Schritt 4: Besonderheiten (einfache Ja/Nein Fragen)
    - Schritt 5: Termin + Kontakt
    - Schritt 6: Zusammenfassung

    ---

    ## Technische Hinweise

    - Daten gespeichert in `localStorage` (Key: `raeumung_wizard_data`)
    - Submit via Supabase RPC: `submit_lead_json`
    - Schritt 6 (Zustandsbewertung) nur aktiv wenn `requiresConditionAssessment(raeumungs_art) === true`
    - `form_version: 2`, Status: `pending_verification`
    - `service_type: "raeumung"`
