-- Seed city-based disposal landing pages for Swiss regions

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
  format('entsorgung-%s', city_slug),
  'disposal',
  format('Entsorgung %s: Offerten vergleichen | Offerio.ch', city_name),
  format('Suchen Sie eine Entsorgung in %s? Vergleichen Sie kostenlose Offerten von geprueften Entsorgungsfirmen.', city_name),
  ARRAY[
    format('Entsorgung %s', city_name),
    format('Raeumung %s', city_name),
    format('Sperrguet entsorgen %s', city_name),
    'Entsorgung Schweiz',
    'Entsorgungsfirma',
    'Offerio'
  ]::TEXT[],
  format('https://offerio.ch/entsorgung-%s', city_slug),
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=1600&q=80',
  format('Entsorgung in %s: schnell passende Offerten erhalten', city_name),
  format('Transparent vergleichen in %s und Umgebung', city_name),
  format('Offerio hilft Ihnen in %s bei der Suche nach passenden Entsorgungsdiensten fuer Haushalt, Buero und Raeumungen.', city_name),
  'https://images.unsplash.com/photo-1604187351574-c75ca79f5807?auto=format&fit=crop&w=1600&q=80',
  'Kostenlose Entsorgungsofferte anfragen',
  '/anfrage/entsorgung',
  jsonb_build_array(
    jsonb_build_object(
      'id', city_slug || '-disposal-intro',
      'type', 'text_block',
      'order', 1,
      'layout', 'standard',
      'text_align', 'left',
      'title', format('Entsorgung in %s richtig planen', city_name),
      'content', format($html$
<p>Bei Entsorgungen in %1$s sind Aufwand, Zufahrt, Volumen und Materialarten entscheidend. Mit Offerio vergleichen Sie mehrere Offerten und waehlen den Anbieter, der zu Ihrem Zeitplan passt.</p>
<p>Ob Kellerraeumung, Wohnungsaufloesung oder Sperrgutabholung: Eine saubere Leistungsbeschreibung sorgt fuer transparente Preise und vermeidet Nachkosten.</p>
$html$, city_name)
    ),
    jsonb_build_object(
      'id', city_slug || '-disposal-benefits',
      'type', 'feature_grid',
      'order', 2,
      'title', format('Vorteile der Entsorgungsofferte in %s', city_name),
      'features', jsonb_build_array(
        jsonb_build_object('icon', 'check-circle', 'title', 'Mehrere Offerten', 'description', 'Preise und Leistungen direkt vergleichen.'),
        jsonb_build_object('icon', 'package', 'title', 'Passende Leistungen', 'description', 'Von Sperrgut bis komplette Raeumung flexibel kombinierbar.'),
        jsonb_build_object('icon', 'shield', 'title', 'Gepruefte Partner', 'description', format('Regionale Anbieter aus %s und Umgebung.', city_name))
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-disposal-steps',
      'type', 'process_steps',
      'order', 3,
      'title', 'So funktioniert es',
      'steps', jsonb_build_array(
        jsonb_build_object('number', 1, 'title', 'Anfrage erstellen', 'description', 'Objektart, Volumen und Termin angeben.'),
        jsonb_build_object('number', 2, 'title', 'Offerten erhalten', 'description', 'Geeignete Entsorgungsfirmen melden sich mit Angeboten.'),
        jsonb_build_object('number', 3, 'title', 'Firma waehlen', 'description', 'Nach Preis, Leistung und Verfuegbarkeit entscheiden.')
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-disposal-image',
      'type', 'image_text',
      'order', 4,
      'layout', 'standard',
      'image_position', 'right',
      'title', format('Kostenfaktoren fuer Entsorgung in %s', city_name),
      'content', $html$
<ul>
  <li><strong>Volumen:</strong> Menge und Gewicht beeinflussen Transport und Personal.</li>
  <li><strong>Zugang:</strong> Etagen, Lift und Parksituation wirken sich auf den Aufwand aus.</li>
  <li><strong>Material:</strong> Unterschiedliche Materialarten erfordern unterschiedliche Entsorgungswege.</li>
</ul>
<p>Haeufig wird Entsorgung mit <a href='/anfrage/raeumung'>Raeumung</a> oder anschliessender <a href='/anfrage/reinigung'>Reinigung</a> kombiniert.</p>
$html$,
      'image_url', 'https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1400&q=80',
      'image_alt_text', format('Entsorgung und Sortierung von Material in %s', city_name),
      'cta_text', 'Jetzt Entsorgungsofferte erhalten',
      'cta_link', '/anfrage/entsorgung',
      'cta_style', 'primary'
    ),
    jsonb_build_object(
      'id', city_slug || '-disposal-cta',
      'type', 'cta_banner',
      'order', 5,
      'title', format('Entsorgung in %s jetzt anfragen', city_name),
      'content', 'Unverbindlich vergleichen und passende Offerten erhalten.',
      'cta_text', 'Kostenlose Offerte starten',
      'cta_link', '/anfrage/entsorgung',
      'background_color', '#2563eb'
    )
  ),
  TRUE,
  'global_faq',
  jsonb_build_object(
    'contact_widget', jsonb_build_object(
      'enabled', true,
      'title', format('Entsorgungsberatung fuer %s', city_name),
      'phone', '+41 44 123 45 67',
      'email', 'info@offerio.ch',
      'cta_text', 'Jetzt Entsorgung planen'
    ),
    'related_services', jsonb_build_array(
      jsonb_build_object('title', 'Raeumung', 'description', 'Komplette Raeumungslösungen', 'link', '/anfrage/raeumung', 'icon', 'package'),
      jsonb_build_object('title', 'Reinigung', 'description', 'Anschlussreinigung nach Entsorgung', 'link', '/anfrage/reinigung', 'icon', 'sparkles'),
      jsonb_build_object('title', 'Umzug', 'description', 'Bei Wohnungswechsel sinnvoll kombinieren', 'link', '/anfrage/umzug', 'icon', 'truck')
    ),
    'related_locations', jsonb_build_array(
      jsonb_build_object('name', rel_name_1, 'link', format('/entsorgung-%s', rel_slug_1)),
      jsonb_build_object('name', rel_name_2, 'link', format('/entsorgung-%s', rel_slug_2)),
      jsonb_build_object('name', rel_name_3, 'link', format('/entsorgung-%s', rel_slug_3))
    ),
    'trust_elements', jsonb_build_array(
      jsonb_build_object('type', 'stat', 'title', 'Anfrage in Minuten', 'value', '2 Min', 'icon', 'check-circle'),
      jsonb_build_object('type', 'stat', 'title', 'Partner in der Schweiz', 'value', '500+', 'icon', 'package'),
      jsonb_build_object('type', 'certification', 'title', 'Transparenter Offertenvergleich', 'icon', 'shield')
    )
  ),
  TRUE,
  NOW()
FROM city_pages
ON CONFLICT (slug) DO NOTHING;

