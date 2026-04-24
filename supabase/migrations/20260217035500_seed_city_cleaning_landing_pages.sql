-- Seed city-based cleaning landing pages for Swiss regions
-- Structured for topical SEO and internal linking

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
  format('reinigung-%s', city_slug) AS slug,
  'cleaning' AS service_type,
  format('Reinigung %s: Offerten vergleichen | Offerio.ch', city_name) AS seo_title,
  format(
    'Suchen Sie eine Reinigung in %s? Vergleichen Sie kostenlose Offerten von geprueften Reinigungsfirmen in Ihrer Region.',
    city_name
  ) AS seo_description,
  ARRAY[
    format('Reinigung %s', city_name),
    format('Endreinigung %s', city_name),
    format('Reinigungsfirma %s', city_name),
    'Reinigung Schweiz',
    'Abgabereinigung',
    'Offerio'
  ]::TEXT[] AS seo_keywords,
  format('https://offerio.ch/reinigung-%s', city_slug) AS canonical_url,
  'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=80' AS og_image_url,
  format('Reinigung in %s: gepruefte Firmen und transparente Offerten', city_name) AS hero_title,
  format('Schnell vergleichbar in %s und Umgebung', city_name) AS hero_subtitle,
  format(
    'Mit Offerio vergleichen Sie in %s mehrere Reinigungsofferten, inklusive Endreinigung mit Abnahmegarantie und optionalen Zusatzleistungen.',
    city_name
  ) AS hero_description,
  'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=1600&q=80' AS hero_image_url,
  'Kostenlose Reinigungsofferte anfragen' AS hero_cta_text,
  '/anfrage/reinigung' AS hero_cta_link,
  jsonb_build_array(
    jsonb_build_object(
      'id', city_slug || '-cleaning-intro',
      'type', 'text_block',
      'order', 1,
      'layout', 'standard',
      'text_align', 'left',
      'title', format('Reinigung in %s: worauf Sie bei Offerten achten sollten', city_name),
      'content', format($html$
<p>Ob Umzugsreinigung, Unterhaltsreinigung oder Fruehjahrsputz: In %1$s lohnt sich ein strukturierter Offertenvergleich. Achten Sie auf Leistungsumfang, Materialkosten, Anfahrt und ob eine Abnahmegarantie enthalten ist.</p>
<p>Mit <a href='/anfrage/reinigung'>Offerio</a> erhalten Sie mehrere unverbindliche Angebote und koennen die Leistungen direkt vergleichen. Allgemeine Verbraucherinformationen finden Sie auch auf <a href='https://www.ch.ch/de/' rel='noopener noreferrer'>ch.ch</a>.</p>
$html$, city_name)
    ),
    jsonb_build_object(
      'id', city_slug || '-cleaning-features',
      'type', 'feature_grid',
      'order', 2,
      'title', format('Ihre Vorteile bei der Reinigung in %s', city_name),
      'features', jsonb_build_array(
        jsonb_build_object(
          'icon', 'check-circle',
          'title', 'Mehrere Offerten auf einen Blick',
          'description', 'Sie vergleichen Preise und Leistungen ohne mehrere Firmen einzeln anschreiben zu muessen.'
        ),
        jsonb_build_object(
          'icon', 'sparkles',
          'title', 'Abnahmeorientierte Reinigung',
          'description', 'Viele Partner bieten Endreinigung mit klar definierten Abgabestandards.'
        ),
        jsonb_build_object(
          'icon', 'shield',
          'title', 'Gepruefte Anbieter',
          'description', format('Lokale Reinigungsfirmen aus %s und Umgebung mit professionellem Service.', city_name)
        )
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-cleaning-process',
      'type', 'process_steps',
      'order', 3,
      'title', 'In 3 Schritten zur passenden Reinigungsofferte',
      'steps', jsonb_build_array(
        jsonb_build_object(
          'number', 1,
          'title', 'Bedarf erfassen',
          'description', 'Sie geben Objektgroesse, Reinigungsart und Wunschtermin an.'
        ),
        jsonb_build_object(
          'number', 2,
          'title', 'Angebote erhalten',
          'description', 'Passende Firmen senden konkrete Offerten mit Leistungsdetails.'
        ),
        jsonb_build_object(
          'number', 3,
          'title', 'Anbieter auswaehlen',
          'description', 'Sie waehlen nach Preis, Leistung und Verfuegbarkeit den passenden Partner.'
        )
      )
    ),
    jsonb_build_object(
      'id', city_slug || '-cleaning-image',
      'type', 'image_text',
      'order', 4,
      'layout', 'standard',
      'image_position', 'right',
      'title', format('Reinigungskosten in %s realistisch planen', city_name),
      'content', format($html$
<p>Die Kosten richten sich nach Flaeche, Verschmutzungsgrad und Sonderleistungen wie Fenster, Backofen oder Nasszellen. Verlangen Sie immer eine klare Leistungsaufstellung.</p>
<ul>
  <li><strong>Flache:</strong> Groessere Objekte benoetigen mehr Personalzeit.</li>
  <li><strong>Leistungsumfang:</strong> Endreinigung, Unterhalt oder Spezialreinigung klar unterscheiden.</li>
  <li><strong>Kombi-Services:</strong> Bei Umzug oft sinnvoll mit <a href='/anfrage/umzug'>Umzugsofferte</a> kombinieren.</li>
</ul>
$html$, city_name),
      'image_url', 'https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?auto=format&fit=crop&w=1400&q=80',
      'image_alt_text', format('Professionelle Wohnungsreinigung in %s mit Reinigungsgeraeten', city_name),
      'cta_text', 'Jetzt Reinigungsofferten vergleichen',
      'cta_link', '/anfrage/reinigung',
      'cta_style', 'primary'
    ),
    jsonb_build_object(
      'id', city_slug || '-cleaning-cta',
      'type', 'cta_banner',
      'order', 5,
      'title', format('Reinigung in %s jetzt kostenlos anfragen', city_name),
      'content', 'Vergleichen Sie in wenigen Minuten mehrere Offerten von passenden Reinigungsfirmen.',
      'cta_text', 'Kostenlose Offerte erhalten',
      'cta_link', '/anfrage/reinigung',
      'background_color', '#2563eb'
    )
  ) AS content_sections,
  TRUE AS use_shared_content,
  'cleaning_faq' AS faq_source,
  jsonb_build_object(
    'contact_widget', jsonb_build_object(
      'enabled', true,
      'title', format('Reinigungsberatung fuer %s', city_name),
      'phone', '+41 44 123 45 67',
      'email', 'info@offerio.ch',
      'cta_text', 'Jetzt Reinigung planen'
    ),
    'related_services', jsonb_build_array(
      jsonb_build_object(
        'title', 'Umzug mit passender Planung',
        'description', 'Umzug und Reinigung aus einer Hand koordinieren',
        'link', '/anfrage/umzug',
        'icon', 'truck'
      ),
      jsonb_build_object(
        'title', 'Entsorgung und Raeumung',
        'description', 'Altmaterial vor der Reinigung professionell entfernen',
        'link', '/anfrage/entsorgung',
        'icon', 'package'
      ),
      jsonb_build_object(
        'title', 'Malerarbeiten nach Auszug',
        'description', 'Renovation und Reinigung zeitlich abstimmen',
        'link', '/anfrage/malerarbeiten',
        'icon', 'paintbrush'
      )
    ),
    'related_locations', jsonb_build_array(
      jsonb_build_object('name', rel_name_1, 'link', format('/reinigung-%s', rel_slug_1)),
      jsonb_build_object('name', rel_name_2, 'link', format('/reinigung-%s', rel_slug_2)),
      jsonb_build_object('name', rel_name_3, 'link', format('/reinigung-%s', rel_slug_3))
    ),
    'trust_elements', jsonb_build_array(
      jsonb_build_object('type', 'stat', 'title', 'Anfrage in Minuten', 'value', '2 Min', 'icon', 'check-circle'),
      jsonb_build_object('type', 'stat', 'title', 'Partner in der Schweiz', 'value', '500+', 'icon', 'sparkles'),
      jsonb_build_object('type', 'certification', 'title', 'Transparenter Offertenvergleich', 'icon', 'shield')
    )
  ) AS side_section_config,
  TRUE AS is_published,
  NOW() AS published_at
FROM city_pages
ON CONFLICT (slug) DO NOTHING;

