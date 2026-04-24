-- Seed city-based piano transport landing pages for Swiss regions

WITH city_pages AS (
  SELECT *
  FROM (
    VALUES
      ('zuerich', 'Zuerich', 'winterthur', 'Winterthur', 'uster', 'Uster', 'duebendorf', 'Duebendorf'),
      ('winterthur', 'Winterthur', 'zuerich', 'Zuerich', 'uster', 'Uster', 'duebendorf', 'Duebendorf'),
      ('uster', 'Uster', 'zuerich', 'Zuerich', 'winterthur', 'Winterthur', 'duebendorf', 'Duebendorf'),
      ('duebendorf', 'Duebendorf', 'zuerich', 'Zuerich', 'winterthur', 'Winterthur', 'uster', 'Uster'),
      ('dietikon', 'Dietikon', 'zuerich', 'Zuerich', 'uster', 'Uster', 'winterthur', 'Winterthur'),

      ('bern', 'Bern', 'thun', 'Thun', 'biel', 'Biel', 'koeniz', 'Koeniz'),
      ('thun', 'Thun', 'bern', 'Bern', 'biel', 'Biel', 'langenthal', 'Langenthal'),
      ('biel', 'Biel', 'bern', 'Bern', 'thun', 'Thun', 'koeniz', 'Koeniz'),
      ('koeniz', 'Koeniz', 'bern', 'Bern', 'thun', 'Thun', 'biel', 'Biel'),
      ('langenthal', 'Langenthal', 'bern', 'Bern', 'thun', 'Thun', 'biel', 'Biel'),

      ('basel', 'Basel', 'allschwil', 'Allschwil', 'riehen', 'Riehen', 'liestal', 'Liestal'),
      ('allschwil', 'Allschwil', 'basel', 'Basel', 'riehen', 'Riehen', 'liestal', 'Liestal'),
      ('riehen', 'Riehen', 'basel', 'Basel', 'allschwil', 'Allschwil', 'liestal', 'Liestal'),
      ('liestal', 'Liestal', 'basel', 'Basel', 'allschwil', 'Allschwil', 'riehen', 'Riehen'),
      ('aarau', 'Aarau', 'basel', 'Basel', 'liestal', 'Liestal', 'allschwil', 'Allschwil'),

      ('luzern', 'Luzern', 'zug', 'Zug', 'schwyz', 'Schwyz', 'emmen', 'Emmen'),
      ('zug', 'Zug', 'luzern', 'Luzern', 'schwyz', 'Schwyz', 'kriens', 'Kriens'),
      ('schwyz', 'Schwyz', 'luzern', 'Luzern', 'zug', 'Zug', 'kriens', 'Kriens'),
      ('emmen', 'Emmen', 'luzern', 'Luzern', 'zug', 'Zug', 'kriens', 'Kriens'),
      ('kriens', 'Kriens', 'luzern', 'Luzern', 'zug', 'Zug', 'emmen', 'Emmen'),

      ('st-gallen', 'St. Gallen', 'frauenfeld', 'Frauenfeld', 'schaffhausen', 'Schaffhausen', 'chur', 'Chur'),
      ('frauenfeld', 'Frauenfeld', 'st-gallen', 'St. Gallen', 'schaffhausen', 'Schaffhausen', 'wil', 'Wil'),
      ('schaffhausen', 'Schaffhausen', 'st-gallen', 'St. Gallen', 'frauenfeld', 'Frauenfeld', 'wil', 'Wil'),
      ('chur', 'Chur', 'st-gallen', 'St. Gallen', 'frauenfeld', 'Frauenfeld', 'wil', 'Wil'),
      ('wil', 'Wil', 'st-gallen', 'St. Gallen', 'frauenfeld', 'Frauenfeld', 'schaffhausen', 'Schaffhausen')
  ) AS t(city_slug, city_name, rel_slug_1, rel_name_1, rel_slug_2, rel_name_2, rel_slug_3, rel_name_3)
)
INSERT INTO public.landing_pages (
  slug,
  service_type,
  seo_title,
  seo_description,
  seo_keywords,
  canonical_url,
  og_image_url,
  hero_title,
  hero_subtitle,
  hero_description,
  hero_image_url,
  hero_cta_text,
  hero_cta_link,
  content_sections,
  use_shared_content,
  faq_source,
  side_section_config,
  is_published,
  published_at
)
SELECT
  format('klaviertransport-%s', city_slug),
  'transport',
  format('Klaviertransport %s: Offerten vergleichen | Offerio.ch', city_name),
  format('Sicherer Klaviertransport in %s. Vergleichen Sie kostenlose Offerten von geprueften Spezialfirmen.', city_name),
  ARRAY[
    format('Klaviertransport %s', city_name),
    format('Pianotransport %s', city_name),
    format('Fluegeltransport %s', city_name),
    'Klaviertransport Schweiz',
    'Piano Umzug',
    'Offerio'
  ]::TEXT[],
  format('https://offerio.ch/klaviertransport-%s', city_slug),
  'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=1600&q=80',
  format('Klaviertransport in %s: sicher, geplant und versichert', city_name),
  format('Spezialisierte Transporte in %s und Umgebung', city_name),
  format('Mit Offerio vergleichen Sie in %s Offerten fuer Klavier- und Fluegeltransport von geprueften Fachfirmen.', city_name),
  'https://images.unsplash.com/photo-1513883049090-d0b7439799bf?auto=format&fit=crop&w=1600&q=80',
  'Kostenlose Klaviertransport-Offerte anfragen',
  '/anfrage/klaviertransport',
  jsonb_build_array(
    jsonb_build_object(
      'id', city_slug || '-piano-intro',
      'type', 'text_block',
      'order', 1,
      'layout', 'standard',
      'text_align', 'left',
      'title', format('Klaviertransport in %s professionell organisieren', city_name),
      'content', format($html$
<p>Ein Klaviertransport in %1$s verlangt Erfahrung, passende Ausruestung und eine saubere Planung. Gewicht, Treppen, Lift und Zufahrt bestimmen Aufwand und Kosten.</p>
<p>Auf Offerio erhalten Sie mehrere vergleichbare Offerten von spezialisierten Transportfirmen. So entscheiden Sie transparent nach Preis, Leistung und Termin.</p>
$html$, city_name)
    ),
    jsonb_build_object(
      'id', city_slug || '-piano-features',
      'type', 'feature_grid',
      'order', 2,
      'title', format('Ihre Vorteile beim Klaviertransport in %s', city_name),
      'features', jsonb_build_array(
        jsonb_build_object('icon', 'check-circle', 'title', 'Mehrere Offerten', 'description', 'Spezialisierte Anbieter direkt vergleichen.'),
        jsonb_build_object('icon', 'truck', 'title', 'Spezialausruestung', 'description', 'Geeignete Transporthilfen fuer empfindliche Instrumente.'),
        jsonb_build_object('icon', 'shield', 'title', 'Risikominimierung', 'description', 'Sichere Handhabung und strukturierte Transportplanung.')
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-piano-steps',
      'type', 'process_steps',
      'order', 3,
      'title', 'So funktioniert der Offertenvergleich',
      'steps', jsonb_build_array(
        jsonb_build_object('number', 1, 'title', 'Transportdetails erfassen', 'description', 'Instrumenttyp, Etagen und Adressen angeben.'),
        jsonb_build_object('number', 2, 'title', 'Angebote erhalten', 'description', 'Spezialisierte Firmen senden individuelle Offerten.'),
        jsonb_build_object('number', 3, 'title', 'Passende Firma waehlen', 'description', 'Nach Sicherheitskonzept, Preis und Termin entscheiden.')
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-piano-image',
      'type', 'image_text',
      'order', 4,
      'layout', 'standard',
      'image_position', 'right',
      'title', format('Kostenfaktoren fuer Klaviertransport in %s', city_name),
      'content', $html$
<ul>
  <li><strong>Instrumenttyp:</strong> Upright, Klavier oder Fluegel haben unterschiedliche Anforderungen.</li>
  <li><strong>Zugang:</strong> Treppenhaus, Lift und Distanz zum Fahrzeug beeinflussen Aufwand.</li>
  <li><strong>Zusatzleistungen:</strong> Zwischenlagerung oder Terminfenster koennen integriert werden.</li>
</ul>
<p>Bei einem kompletten Wohnungswechsel laesst sich der Klaviertransport mit einer <a href='/anfrage/umzug'>Umzugsofferte</a> kombinieren.</p>
$html$,
      'image_url', 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?auto=format&fit=crop&w=1400&q=80',
      'image_alt_text', format('Sicherer Transport eines Klaviers in %s', city_name),
      'cta_text', 'Jetzt Klaviertransport anfragen',
      'cta_link', '/anfrage/klaviertransport',
      'cta_style', 'primary'
    ),
    jsonb_build_object(
      'id', city_slug || '-piano-cta',
      'type', 'cta_banner',
      'order', 5,
      'title', format('Klaviertransport in %s jetzt starten', city_name),
      'content', 'In wenigen Minuten mehrere Offerten von Spezialfirmen erhalten.',
      'cta_text', 'Kostenlose Offerte starten',
      'cta_link', '/anfrage/klaviertransport',
      'background_color', '#2563eb'
    )
  ),
  TRUE,
  'global_faq',
  jsonb_build_object(
    'contact_widget', jsonb_build_object(
      'enabled', true,
      'title', format('Klaviertransport-Beratung fuer %s', city_name),
      'phone', '+41 44 123 45 67',
      'email', 'info@offerio.ch',
      'cta_text', 'Jetzt Transport planen'
    ),
    'related_services', jsonb_build_array(
      jsonb_build_object('title', 'Umzug', 'description', 'Klaviertransport im Gesamtumzug integrieren', 'link', '/anfrage/umzug', 'icon', 'truck'),
      jsonb_build_object('title', 'Lagerung', 'description', 'Zwischenlagerung bei Terminverschiebung', 'link', '/anfrage/lagerung', 'icon', 'warehouse'),
      jsonb_build_object('title', 'Moebellift', 'description', 'Sinnvoll bei engen Treppenhaeusern', 'link', '/anfrage/moebellift', 'icon', 'arrow-right')
    ),
    'related_locations', jsonb_build_array(
      jsonb_build_object('name', rel_name_1, 'link', format('/klaviertransport-%s', rel_slug_1)),
      jsonb_build_object('name', rel_name_2, 'link', format('/klaviertransport-%s', rel_slug_2)),
      jsonb_build_object('name', rel_name_3, 'link', format('/klaviertransport-%s', rel_slug_3))
    ),
    'trust_elements', jsonb_build_array(
      jsonb_build_object('type', 'stat', 'title', 'Anfrage in Minuten', 'value', '2 Min', 'icon', 'check-circle'),
      jsonb_build_object('type', 'stat', 'title', 'Partner in der Schweiz', 'value', '500+', 'icon', 'truck'),
      jsonb_build_object('type', 'certification', 'title', 'Transparenter Offertenvergleich', 'icon', 'shield')
    )
  ),
  TRUE,
  NOW()
FROM city_pages
ON CONFLICT (slug) DO NOTHING;

