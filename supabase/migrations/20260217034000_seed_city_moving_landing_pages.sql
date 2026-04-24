-- Seed city-based moving landing pages for Swiss regions
-- EEAT + topical SEO oriented structure with internal/external links

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
  format('umzug-%s', city_slug) AS slug,
  'moving' AS service_type,
  format('Umzug %s: Offerten vergleichen | Offerio.ch', city_name) AS seo_title,
  format(
    'Planen Sie einen Umzug in %s? Vergleichen Sie kostenlose Offerten von geprueften Umzugsfirmen in Ihrer Region. Transparent, schnell und unverbindlich.',
    city_name
  ) AS seo_description,
  ARRAY[
    format('Umzug %s', city_name),
    format('Umzugsfirma %s', city_name),
    format('Umzugskosten %s', city_name),
    'Umzug Schweiz',
    'Umzug Offerte',
    'Offerio'
  ]::TEXT[] AS seo_keywords,
  format('https://offerio.ch/umzug-%s', city_slug) AS canonical_url,
  'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?auto=format&fit=crop&w=1600&q=80' AS og_image_url,
  format('Umzug in %s: Offerten von geprueften Umzugsfirmen vergleichen', city_name) AS hero_title,
  format('Schnell, transparent und kostenlos in %s', city_name) AS hero_subtitle,
  format(
    'Mit Offerio erhalten Sie in %s mehrere vergleichbare Offerten von passenden Umzugsfirmen. So entscheiden Sie auf Basis von Preis, Leistung und Verfuegbarkeit.',
    city_name
  ) AS hero_description,
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=80' AS hero_image_url,
  'Kostenlose Umzugsofferte anfragen' AS hero_cta_text,
  '/anfrage/umzug' AS hero_cta_link,
  jsonb_build_array(
    jsonb_build_object(
      'id', city_slug || '-intro',
      'type', 'text_block',
      'order', 1,
      'layout', 'standard',
      'text_align', 'left',
      'title', format('Umzug in %s: Planung, Kosten und Anbieterwahl', city_name),
      'content', format($html$
<p>Ein Umzug in %1$s gelingt am besten mit klarer Planung, realistischen Kosten und einer passenden Umzugsfirma. Auf Offerio vergleichen Sie mehrere unverbindliche Offerten und finden den Anbieter, der zu Ihrem Budget und Zeitplan passt.</p>
<p>Nutzen Sie unser <a href='/anfrage/umzug'>Umzugsformular</a>, um Ihre Eckdaten zu erfassen. Fuer Hintergrundinfos zur Ab- und Anmeldung in der Schweiz finden Sie auch hilfreiche Hinweise auf <a href='https://www.ch.ch/de/' rel='noopener noreferrer'>ch.ch</a> und zum Transportnetz auf <a href='https://www.sbb.ch/de' rel='noopener noreferrer'>sbb.ch</a>.</p>
<p>Wichtig fuer eine saubere Angebotspruefung: Leistungsumfang (Ein-/Auspacken, Moebelmontage), Versicherung, Fixpreis oder Stundenansatz, sowie moegliche Zusatzkosten bei Halteverbotszonen oder langen Tragewegen.</p>
$html$, city_name)
    ),
    jsonb_build_object(
      'id', city_slug || '-benefits',
      'type', 'feature_grid',
      'order', 2,
      'title', format('Ihre Vorteile beim Umzug in %s mit Offerio', city_name),
      'features', jsonb_build_array(
        jsonb_build_object(
          'icon', 'check-circle',
          'title', 'Mehrere Offerten statt Einzelanfrage',
          'description', 'Sie erhalten mehrere vergleichbare Angebote und sparen Zeit bei der Suche nach einer geeigneten Umzugsfirma.'
        ),
        jsonb_build_object(
          'icon', 'shield',
          'title', 'Gepruefte Partnerfirmen',
          'description', 'Wir arbeiten mit Firmen, die professionell auftreten und den Schweizer Markt sowie lokale Gegebenheiten kennen.'
        ),
        jsonb_build_object(
          'icon', 'truck',
          'title', 'Regionale Verfuegbarkeit',
          'description', format('Anbieter aus %s und Umgebung reagieren schneller und planen effizientere Routen.', city_name)
        )
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-process',
      'type', 'process_steps',
      'order', 3,
      'title', 'So funktioniert der Offertenvergleich',
      'steps', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'title', 'Anfrage absenden',
          'description', 'Sie teilen Wohnungsgrösse, Umzugsdatum, Start-/Zieladresse und Zusatzleistungen mit.'
        ),
        jsonb_build_object(
          'number', 2,
          'title', 'Offerten erhalten',
          'description', 'Passende Umzugsfirmen melden sich mit konkreten Konditionen und Leistungen.'
        ),
        jsonb_build_object(
          'number', 3,
          'title', 'Vergleichen und beauftragen',
          'description', 'Sie vergleichen Preis, Leistungsumfang und Verfuegbarkeit und buchen den besten Anbieter.'
        )
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-image-text',
      'type', 'image_text',
      'order', 4,
      'layout', 'standard',
      'image_position', 'right',
      'title', format('Umzugskosten in %s realistisch einschaetzen', city_name),
      'content', format($html$
<p>Die Umzugskosten haengen meist von Volumen, Distanz, Etagen, Lift-Situation und Zusatzservices ab. Fuer eine bessere Vergleichbarkeit empfehlen wir, immer auf identische Leistungspositionen zu achten.</p>
<ul>
  <li><strong>Volumen:</strong> Je mehr Kubikmeter, desto mehr Personal und Fahrzeuge werden benoetigt.</li>
  <li><strong>Logistik:</strong> Park- und Zufahrtssituation beeinflussen Aufwand und Dauer.</li>
  <li><strong>Zusatzleistungen:</strong> Verpackung, Demontage/Montage und Endreinigung separat ausweisen lassen.</li>
</ul>
<p>Wenn Sie nach dem Umzug eine Reinigung benoetigen, koennen Sie direkt auch eine <a href='/anfrage/reinigung'>Reinigungsofferte</a> anfragen.</p>
$html$, city_name),
      'image_url', 'https://images.unsplash.com/photo-1560185007-cde436f6a4d0?auto=format&fit=crop&w=1400&q=80',
      'image_alt_text', format('Professionelles Umzugsteam beim Tragen von Umzugskartons in %s', city_name),
      'cta_text', 'Jetzt Umzugsofferten vergleichen',
      'cta_link', '/anfrage/umzug',
      'cta_style', 'primary'
    ),
    jsonb_build_object(
      'id', city_slug || '-cta',
      'type', 'cta_banner',
      'order', 5,
      'title', format('Bereit fuer Ihren Umzug in %s?', city_name),
      'content', 'Starten Sie jetzt kostenlos und vergleichen Sie passende Offerten in wenigen Minuten.',
      'cta_text', 'Kostenlose Offerte erhalten',
      'cta_link', '/anfrage/umzug',
      'background_color', '#2563eb'
    )
  ) AS content_sections,
  TRUE AS use_shared_content,
  'moving_faq' AS faq_source,
  jsonb_build_object(
    'contact_widget', jsonb_build_object(
      'enabled', true,
      'title', format('Umzugsberatung fuer %s', city_name),
      'phone', '+41 44 123 45 67',
      'email', 'info@offerio.ch',
      'cta_text', 'Jetzt Umzug planen'
    ),
    'related_services', jsonb_build_array(
      jsonb_build_object(
        'title', 'Endreinigung mit Abnahmegarantie',
        'description', 'Ideal als Kombi nach dem Umzug',
        'link', '/anfrage/reinigung',
        'icon', 'sparkles'
      ),
      jsonb_build_object(
        'title', 'Malerarbeiten nach dem Auszug',
        'description', 'Schnelle Angebote fuer Renovationsarbeiten',
        'link', '/anfrage/malerarbeiten',
        'icon', 'paintbrush'
      ),
      jsonb_build_object(
        'title', 'Moebellift fuer enge Zugaenge',
        'description', 'Effiziente Loesung bei schwierigen Treppenhaeusern',
        'link', '/anfrage/moebellift',
        'icon', 'truck'
      )
    ),
    'related_locations', jsonb_build_array(
      jsonb_build_object('name', rel_name_1, 'link', format('/umzug-%s', rel_slug_1)),
      jsonb_build_object('name', rel_name_2, 'link', format('/umzug-%s', rel_slug_2)),
      jsonb_build_object('name', rel_name_3, 'link', format('/umzug-%s', rel_slug_3))
    ),
    'trust_elements', jsonb_build_array(
      jsonb_build_object('type', 'stat', 'title', 'Vergleich in Minuten', 'value', '2 Min', 'icon', 'check-circle'),
      jsonb_build_object('type', 'stat', 'title', 'Partner in der Schweiz', 'value', '500+', 'icon', 'truck'),
      jsonb_build_object('type', 'certification', 'title', 'Transparenter Offertenvergleich', 'icon', 'shield')
    )
  ) AS side_section_config,
  TRUE AS is_published,
  NOW() AS published_at
FROM city_pages
ON CONFLICT (slug) DO NOTHING;

