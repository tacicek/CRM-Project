export interface Testimonial {
  id: number;
  name: string;
  location: string;
  service: string;
  date: string;
  rating: number;
  text: string;
  /** Specific measurable outcome for trust */
  outcome?: string;
}

export const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Sandra Meier",
    location: "Zürich",
    service: "Umzug",
    date: "Oktober 2024",
    rating: 5,
    text: "Innert weniger Stunden hatte ich 4 Offerten für meinen Umzug von Zürich nach Bern. Ohne Offerio hätte mich das Tage an Recherche gekostet.",
    outcome: "CHF 1'200 gespart vs. Erstangebot",
  },
  {
    id: 2,
    name: "Thomas Keller",
    location: "Basel",
    service: "Reinigung",
    date: "September 2024",
    rating: 5,
    text: "Die Endreinigung wurde perfekt erledigt. Abnahme beim Vermieter war kein Problem — keine Nachforderungen. Kann ich nur empfehlen!",
    outcome: "100% Abnahme-Erfolg beim Vermieter",
  },
  {
    id: 3,
    name: "Peter Schmid",
    location: "Luzern",
    service: "Räumung",
    date: "August 2024",
    rating: 5,
    text: "Nach dem Tod meiner Mutter brauchte ich schnell Hilfe bei der Wohnungsräumung. Innerhalb von 24h hatten wir 3 Angebote. Sehr einfühlsam und professionell.",
    outcome: "3 Offerten in unter 24 Stunden",
  },
  {
    id: 4,
    name: "Maria Brunner",
    location: "Bern",
    service: "Umzug & Reinigung",
    date: "November 2024",
    rating: 5,
    text: "Umzug und Endreinigung aus einer Hand organisiert. Das hat mir enorm viel Stress erspart. Die Firmen, die sich gemeldet haben, waren alle seriös.",
    outcome: "Umzug + Reinigung in einem Schritt erledigt",
  },
  {
    id: 5,
    name: "Marco Rossi",
    location: "St. Gallen",
    service: "Umzug",
    date: "Dezember 2024",
    rating: 4,
    text: "5 Offerten verglichen und die günstigste war fast halb so teuer wie die teuerste. Ohne den Vergleich hätte ich viel mehr bezahlt.",
    outcome: "43% Preisunterschied zwischen Offerten",
  },
  {
    id: 6,
    name: "Andrea Müller",
    location: "Winterthur",
    service: "Reinigung",
    date: "Januar 2025",
    rating: 5,
    text: "Endlich ein Portal, das wirklich kostenlos ist. Keine versteckten Gebühren, keine Haken. Einfach Formular ausfüllen und Offerten erhalten.",
    outcome: "100% kostenlos — kein Haken",
  },
];
