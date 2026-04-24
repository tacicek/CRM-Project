import { Truck, Sparkles, Trash2, Box, Piano, ArrowUp, Package, Paintbrush, Wrench } from "lucide-react";

export const services = [
  {
    id: "umzug",
    title: "Umzug",
    description: "Stressfreier Umzug in der Schweiz. Von der 1-Zimmer-Wohnung bis zum kompletten Firmenumzug. Inklusive Verpackung, Transport und Montage auf Wunsch.",
    icon: Truck,
    link: "/anfrage/umzug",
    features: ["Privatumzug", "Firmenumzug", "Internationaler Umzug", "Seniorenumzug"]
  },
  {
    id: "reinigung",
    title: "Reinigung",
    description: "Professionelle Endreinigung und Grundreinigung mit Abnahmegarantie. Für eine stressfreie Wohnungsübergabe in der ganzen Schweiz.",
    icon: Sparkles,
    link: "/anfrage/reinigung",
    features: ["Endreinigung / Umzugsreinigung", "Grundreinigung", "Fensterreinigung", "Teppichreinigung"]
  },
  {
    id: "raeumung",
    title: "Räumung",
    description: "Professionelle Entrümpelung und Haushaltsauflösung. Diskret und zuverlässig, auch bei Todesfall oder Messie-Situationen.",
    icon: Trash2,
    link: "/anfrage/raeumung",
    features: ["Haushaltsauflösung", "Entrümpelung", "Nachlassräumung", "Kellerräumung"]
  },
  {
    id: "klaviertransport",
    title: "Klaviertransport",
    description: "Sicherer Transport von Klavieren und Flügeln durch spezialisierte Fachfirmen. Mit Versicherung und professionellem Equipment.",
    icon: Piano,
    link: "/anfrage/klaviertransport",
    features: ["Klaviertransport", "Flügeltransport", "Instrumententransport", "Tresortransport"]
  },
  {
    id: "moebellift",
    title: "Möbellift",
    description: "Möbellift mieten für einen einfachen und schnellen Umzug. Ideal für höhere Stockwerke und sperrige Möbelstücke.",
    icon: ArrowUp,
    link: "/anfrage/moebellift",
    features: ["Möbellift mieten", "Fassadenlift", "Bauaufzug", "Inkl. Bedienpersonal"]
  },
  {
    id: "lagerung",
    title: "Lagerung",
    description: "Sichere und trockene Lagerräume für Ihre Möbel und Kartons. Flexibel mietbar für kurze oder lange Zeiträume.",
    icon: Box,
    link: "/anfrage/lagerung",
    features: ["Möbellagerung", "Self-Storage", "Zwischenlagerung", "Aktenlagerung"]
  },
  {
    id: "spezialtransport",
    title: "Transport",
    description: "Spezialtransporte für schwere oder sperrige Gegenstände. Tresor, Aquarium, Motorrad, Kunstwerk und mehr – sicher und versichert.",
    icon: Package,
    link: "/anfrage/spezialtransport",
    features: ["Tresortransport", "Aquarium", "Motorrad", "Sperrgut"]
  },
  {
    id: "renovation",
    title: "Renovation",
    description: "Renovationsarbeiten aller Art: Boden, Wände, Bad, Küche. Geprüfte Handwerker, klare Offerten, faire Preise.",
    icon: Wrench,
    link: "/anfrage/renovation",
    features: ["Bodenrenovation", "Badsanierung", "Küchenerneuerung", "Komplettrenovation"]
  },
  {
    id: "malerarbeit",
    title: "Malerarbeit",
    description: "Professionelle Malerarbeiten für Innen- und Aussenbereich. Frische Farbe, saubere Arbeit, schnelle Ausführung.",
    icon: Paintbrush,
    link: "/anfrage/malerarbeiten",
    features: ["Innenmalerei", "Aussenmalerei", "Tapezieren", "Fassadenreinigung"]
  },
];

