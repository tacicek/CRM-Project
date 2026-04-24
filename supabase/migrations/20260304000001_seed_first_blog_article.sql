-- Seed first blog article: Umzugskosten Schweiz 2025
-- This article serves as the initial content for the /blog (Ratgeber) section

-- Add featured_image_alt column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'blog_posts' 
    AND column_name = 'featured_image_alt'
  ) THEN
    ALTER TABLE public.blog_posts ADD COLUMN featured_image_alt TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'blog_posts' 
    AND column_name = 'gallery_images'
  ) THEN
    ALTER TABLE public.blog_posts ADD COLUMN gallery_images JSONB DEFAULT '[]';
  END IF;
END $$;

-- Insert the first blog article
INSERT INTO public.blog_posts (
  title,
  slug,
  meta_description,
  content,
  excerpt,
  category_name,
  tags,
  target_service,
  focus_keyword,
  seo_title,
  seo_description,
  status,
  published_at,
  author_name,
  faq_schema
) VALUES (
  'Umzugskosten Schweiz 2025: Was kostet ein Umzug wirklich?',
  'umzugskosten-schweiz',
  'Was kostet ein Umzug in der Schweiz 2025? Durchschnittliche Kosten, Preisfaktoren und Spartipps. Vergleichen Sie jetzt kostenlos Offerten.',
  '<h2>Was kostet ein Umzug in der Schweiz?</h2>
<p>Die Kosten für einen Umzug in der Schweiz variieren stark — von CHF 800 für eine 1-Zimmer-Wohnung bis über CHF 5''000 für ein Einfamilienhaus. In diesem Ratgeber zeigen wir Ihnen, mit welchen Kosten Sie rechnen müssen und wie Sie sparen können.</p>

<h2>Durchschnittliche Umzugskosten 2025</h2>
<p>Die folgenden Durchschnittswerte basieren auf Offerten, die über Offerio.ch eingegangen sind:</p>
<ul>
<li><strong>1-Zimmer-Wohnung:</strong> CHF 600 – 1''200</li>
<li><strong>2-Zimmer-Wohnung:</strong> CHF 1''000 – 2''000</li>
<li><strong>3-Zimmer-Wohnung:</strong> CHF 1''500 – 3''000</li>
<li><strong>4-Zimmer-Wohnung:</strong> CHF 2''000 – 4''000</li>
<li><strong>5+ Zimmer / Haus:</strong> CHF 3''000 – 6''000+</li>
</ul>
<p>Diese Preise gelten für Umzüge innerhalb derselben Stadt oder Region. Für Langstreckenumzüge (z.B. Zürich → Genf) rechnen Sie mit einem Aufschlag von 30-50%.</p>

<h2>Welche Faktoren beeinflussen die Kosten?</h2>
<h3>1. Wohnungsgrösse</h3>
<p>Die Anzahl Zimmer und die Quadratmeter sind der wichtigste Kostenfaktor. Mehr Zimmer bedeuten mehr Möbel, mehr Verpackungsmaterial und mehr Arbeitszeit.</p>

<h3>2. Distanz</h3>
<p>Ein Umzug innerhalb derselben Stadt kostet weniger als ein Umzug über mehrere Kantone. Bei langen Distanzen kommen Transportkosten hinzu.</p>

<h3>3. Stockwerk und Lift</h3>
<p>Wohnungen in höheren Stockwerken ohne Lift erhöhen den Aufwand erheblich. Pro Stockwerk ohne Lift rechnen Sie mit ca. CHF 50-100 Aufpreis.</p>

<h3>4. Zusatzleistungen</h3>
<p>Folgende Zusatzleistungen verursachen Mehrkosten:</p>
<ul>
<li>Verpackungsservice: CHF 300 – 800</li>
<li>Möbelmontage (Ab-/Aufbau): CHF 200 – 500</li>
<li>Reinigung der alten Wohnung: CHF 300 – 1''000</li>
<li>Zwischenlagerung: CHF 100 – 300/Monat</li>
<li>Entsorgung von Altmöbeln: CHF 100 – 500</li>
</ul>

<h3>5. Zeitpunkt</h3>
<p>Umzüge am Monatsende und im Sommer (Juni-September) sind teurer, da die Nachfrage höher ist. Wählen Sie wenn möglich einen Termin unter der Woche oder Mitte Monat.</p>

<h2>So sparen Sie bei Ihrem Umzug</h2>
<ol>
<li><strong>Offerten vergleichen:</strong> Holen Sie mindestens 3-5 Offerten ein. Über Offerio.ch erhalten Sie kostenlos bis zu 5 Angebote.</li>
<li><strong>Frühzeitig planen:</strong> Buchen Sie Ihre Umzugsfirma mindestens 4-6 Wochen im Voraus.</li>
<li><strong>Eigenleistung:</strong> Packen Sie selbst und bauen Sie einfache Möbel selbst ab.</li>
<li><strong>Entrümpeln:</strong> Verkaufen oder entsorgen Sie Dinge, die Sie nicht mehr brauchen — weniger Volumen = geringere Kosten.</li>
<li><strong>Flexibler Termin:</strong> Umzüge unter der Woche oder Mitte Monat sind bis zu 20% günstiger.</li>
<li><strong>Umzug + Reinigung kombinieren:</strong> Über Offerio.ch können Sie beides in einer Anfrage erledigen und profitieren von Kombi-Rabatten.</li>
</ol>

<h2>Umzugskosten nach Stadt</h2>
<p>Die Kosten variieren auch je nach Stadt:</p>
<ul>
<li><strong>Zürich:</strong> 10-20% über dem Durchschnitt (hohe Nachfrage, Parkplatzgebühren)</li>
<li><strong>Bern:</strong> Durchschnittliche Preise</li>
<li><strong>Basel:</strong> Leicht über dem Durchschnitt</li>
<li><strong>Luzern:</strong> Durchschnittliche Preise</li>
<li><strong>Lausanne/Genf:</strong> 15-25% über dem Durchschnitt</li>
</ul>

<h2>Fazit: Offerten vergleichen lohnt sich</h2>
<p>Die Preisunterschiede zwischen Umzugsfirmen können erheblich sein — unsere Daten zeigen Unterschiede von bis zu 43% zwischen der günstigsten und teuersten Offerte. Darum lohnt es sich immer, mehrere Angebote einzuholen und zu vergleichen.</p>
<p><strong>Tipp:</strong> Über <a href="https://offerio.ch/anfrage/umzug">Offerio.ch</a> erhalten Sie kostenlos und unverbindlich bis zu 5 Offerten von geprüften Schweizer Umzugsfirmen. So sparen Sie Zeit und Geld.</p>',
  'Was kostet ein Umzug in der Schweiz 2025? Durchschnittliche Kosten von CHF 800 bis CHF 6''000+, wichtige Preisfaktoren und 6 Spartipps für Ihren nächsten Umzug.',
  'Umzug',
  ARRAY['umzugskosten', 'umzug-schweiz', 'umzugsfirma', 'kosten', 'preisvergleich', 'zürich', 'bern', 'basel'],
  'moving',
  'umzugskosten schweiz',
  'Umzugskosten Schweiz 2025 | Was kostet ein Umzug? | Offerio',
  'Was kostet ein Umzug in der Schweiz 2025? Durchschnittliche Kosten, Preisfaktoren und Spartipps. Vergleichen Sie jetzt kostenlos Offerten.',
  'published',
  NOW(),
  'Offerio Team',
  '[
    {"question": "Was kostet ein Umzug in der Schweiz?", "answer": "Die Kosten variieren je nach Wohnungsgrösse: 1-Zimmer ab CHF 600, 3-Zimmer CHF 1500-3000, 5+ Zimmer ab CHF 3000. Holen Sie kostenlos Offerten ein auf offerio.ch."},
    {"question": "Wie kann ich beim Umzug sparen?", "answer": "Vergleichen Sie mindestens 3-5 Offerten, planen Sie frühzeitig, packen Sie selbst und wählen Sie einen flexiblen Termin unter der Woche."},
    {"question": "Wann ist der beste Zeitpunkt für einen Umzug?", "answer": "Mitte Monat und unter der Woche sind Umzüge bis zu 20% günstiger als am Monatsende oder am Wochenende."},
    {"question": "Sind Umzugskosten in Zürich höher?", "answer": "Ja, in Zürich liegen die Umzugskosten ca. 10-20% über dem Schweizer Durchschnitt, u.a. wegen höherer Nachfrage und Parkplatzgebühren."},
    {"question": "Was kostet eine Endreinigung zusätzlich zum Umzug?", "answer": "Eine Endreinigung kostet je nach Wohnungsgrösse CHF 300-1000. Über Offerio.ch können Sie Umzug und Reinigung kombiniert anfragen und von Kombi-Rabatten profitieren."}
  ]'::jsonb
)
ON CONFLICT (slug) DO NOTHING;
