-- Add gallery images support to blog_posts
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS gallery_images JSONB DEFAULT '[]';

-- Clear and insert more comprehensive categories
DELETE FROM public.blog_categories;

INSERT INTO public.blog_categories (name, slug, description, icon, color) VALUES
('Umzug', 'umzug', 'Tipps und Guides für Ihren Umzug in der Schweiz', 'Truck', 'blue'),
('Reinigung', 'reinigung', 'Alles rund um die Umzugs- und Endreinigung', 'Sparkles', 'green'),
('Entrümpelung', 'entruempelung', 'Wohnungsräumung und fachgerechte Entsorgung', 'Trash2', 'orange'),
('Lagerung', 'lagerung', 'Self-Storage und Möbellagerung Lösungen', 'Warehouse', 'purple'),
('Klaviertransport', 'klaviertransport', 'Spezialtransporte für Klaviere und Flügel', 'Music', 'red'),
('Büroumzug', 'bueroumzug', 'Firmen- und Objektumzüge professionell planen', 'Building2', 'slate'),
('Möbellift', 'moebellift', 'Aussenaufzüge für sperrige Güter', 'ArrowUpCircle', 'cyan'),
('Recht & Versicherung', 'recht-versicherung', 'Rechtliche Aspekte, Mietrecht und Versicherungen', 'ShieldCheck', 'emerald'),
('Checklisten', 'checklisten', 'Schritt-für-Schritt Anleitungen zum Ausdrucken', 'ClipboardList', 'amber'),
('Finanzen & Kosten', 'finanzen-kosten', 'Preise, Spartipps und Budgetplanung', 'Coins', 'lime'),
('Tipps & Tricks', 'tipps-tricks', 'Allgemeine Ratschläge für Mieter und Vermieter', 'Lightbulb', 'yellow');

