-- Seed city-based renovation landing pages for Swiss regions

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
  format('renovation-%s', city_slug),
  'renovation',
  format('Renovation %s: Offerten vergleichen | Offerio.ch', city_name),
  format('Planen Sie eine Renovation in %s? Vergleichen Sie kostenlose Offerten von geprueften Renovationsfirmen.', city_name),
  ARRAY[
    format('Renovation %s', city_name),
    format('Malerarbeiten %s', city_name),
    format('Wohnungsrenovation %s', city_name),
    'Renovation Schweiz',
    'Renovationsfirma',
    'Offerio'
  ]::TEXT[],
  format('https://offerio.ch/renovation-%s', city_slug),
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1600&q=80',
  format('Renovation in %s: passende Fachfirmen vergleichen', city_name),
  format('Klar kalkulierbar in %s und Umgebung', city_name),
  format('Mit Offerio finden Sie in %s passende Fachfirmen fuer Renovation, Malerarbeiten und wertsteigernde Instandsetzung.', city_name),
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?auto=format&fit=crop&w=1600&q=80',
  'Kostenlose Renovationsofferte anfragen',
  '/anfrage/renovation',
  jsonb_build_array(
    jsonb_build_object(
      'id', city_slug || '-reno-intro',
      'type', 'text_block',
      'order', 1,
      'layout', 'standard',
      'text_align', 'left',
      'title', format('Renovation in %s professionell umsetzen', city_name),
      'content', format($html$
<p>Eine Renovation in %1$s erfordert klare Planung, belastbare Kostenschaetzung und koordinierte Gewerke. Mit Offerio erhalten Sie mehrere Offerten und koennen Leistungen transparent vergleichen.</p>
<p>Von Teilrenovationen bis zur kompletten Auffrischung helfen strukturierte Angebote dabei, Budget und Zeitplan sicher einzuhalten.</p>
$html$, city_name)
    ),
    jsonb_build_object(
      'id', city_slug || '-reno-features',
      'type', 'feature_grid',
      'order', 2,
      'title', format('Vorteile fuer Renovation in %s', city_name),
      'features', jsonb_build_array(
        jsonb_build_object('icon', 'check-circle', 'title', 'Offertenvergleich', 'description', 'Mehrere Angebote statt Einzelgespraeche.'),
        jsonb_build_object('icon', 'paintbrush', 'title', 'Fachspezifische Leistungen', 'description', 'Malerarbeiten, Teilrenovation oder Komplettsanierung.'),
        jsonb_build_object('icon', 'shield', 'title', 'Regionale Partner', 'description', format('Gepruefte Anbieter aus %s und Umgebung.', city_name))
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-reno-steps',
      'type', 'process_steps',
      'order', 3,
      'title', 'So gelangen Sie zur passenden Offerte',
      'steps', jsonb_build_array(
        jsonb_build_object('number', 1, 'title', 'Projekt beschreiben', 'description', 'Umfang, Objektzustand und Zeitrahmen definieren.'),
        jsonb_build_object('number', 2, 'title', 'Offerten erhalten', 'description', 'Passende Renovationsfirmen erstellen konkrete Angebote.'),
        jsonb_build_object('number', 3, 'title', 'Leistung vergleichen', 'description', 'Nach Preis, Materialqualitaet und Zeitplan entscheiden.')
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-reno-image',
      'type', 'image_text',
      'order', 4,
      'layout', 'standard',
      'image_position', 'right',
      'title', format('Renovationskosten in %s richtig bewerten', city_name),
      'content', $html$
<ul>
  <li><strong>Leistungsumfang:</strong> Teilrenovation und Komplettsanierung klar trennen.</li>
  <li><strong>Materialstandard:</strong> Qualitaet von Farben, Boden und Ausbau vergleichen.</li>
  <li><strong>Terminplanung:</strong> Puffer fuer Trocknungs- und Abstimmungszeiten beruecksichtigen.</li>
</ul>
<p>Oft sinnvoll in Kombination mit <a href='/anfrage/malerarbeiten'>Malerarbeiten</a> oder einer anschliessenden <a href='/anfrage/reinigung'>Reinigung</a>.</p>
$html$,
      'image_url', 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=1400&q=80',
      'image_alt_text', format('Renovationsarbeiten in einer Wohnung in %s', city_name),
      'cta_text', 'Jetzt Renovationsofferten vergleichen',
      'cta_link', '/anfrage/renovation',
      'cta_style', 'primary'
    ),
    jsonb_build_object(
      'id', city_slug || '-reno-cta',
      'type', 'cta_banner',
      'order', 5,
      'title', format('Renovation in %s jetzt starten', city_name),
      'content', 'Unverbindliche Offerten von passenden Fachfirmen erhalten.',
      'cta_text', 'Kostenlose Offerte starten',
      'cta_link', '/anfrage/renovation',
      'background_color', '#2563eb'
    )
  ),
  TRUE,
  'renovation_faq',
  jsonb_build_object(
    'contact_widget', jsonb_build_object(
      'enabled', true,
      'title', format('Renovationsberatung fuer %s', city_name),
      'phone', '+41 44 123 45 67',
      'email', 'info@offerio.ch',
      'cta_text', 'Jetzt Renovation planen'
    ),
    'related_services', jsonb_build_array(
      jsonb_build_object('title', 'Malerarbeiten', 'description', 'Passend fuer Innen- und Aussenbereiche', 'link', '/anfrage/malerarbeiten', 'icon', 'paintbrush'),
      jsonb_build_object('title', 'Reinigung', 'description', 'Abschlussreinigung nach Renovation', 'link', '/anfrage/reinigung', 'icon', 'sparkles'),
      jsonb_build_object('title', 'Umzug', 'description', 'Bei Objektwechsel sinnvoll kombinieren', 'link', '/anfrage/umzug', 'icon', 'truck')
    ),
    'related_locations', jsonb_build_array(
      jsonb_build_object('name', rel_name_1, 'link', format('/renovation-%s', rel_slug_1)),
      jsonb_build_object('name', rel_name_2, 'link', format('/renovation-%s', rel_slug_2)),
      jsonb_build_object('name', rel_name_3, 'link', format('/renovation-%s', rel_slug_3))
    ),
    'trust_elements', jsonb_build_array(
      jsonb_build_object('type', 'stat', 'title', 'Anfrage in Minuten', 'value', '2 Min', 'icon', 'check-circle'),
      jsonb_build_object('type', 'stat', 'title', 'Partner in der Schweiz', 'value', '500+', 'icon', 'paintbrush'),
      jsonb_build_object('type', 'certification', 'title', 'Transparenter Offertenvergleich', 'icon', 'shield')
    )
  ),
  TRUE,
  NOW()
FROM city_pages
ON CONFLICT (slug) DO NOTHING;

