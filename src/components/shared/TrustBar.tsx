import { ShieldCheck, Star, Users, ThumbsUp } from "lucide-react";

const trustItems = [
  { icon: Users, value: "50'000+", label: "Zufriedene Kunden", sup: "1" },
  { icon: Star, value: "4.8 / 5", label: "Kundenbewertung", sup: "2" },
  { icon: ShieldCheck, value: "500+", label: "Geprüfte Partnerfirmen", sup: "1" },
  { icon: ThumbsUp, value: "98%", label: "Weiterempfehlungsrate", sup: "1" },
];

interface TrustBarProps {
  className?: string;
}

export default function TrustBar({ className = "" }: TrustBarProps) {
  return (
    <section className={`py-10 bg-primary/5 border-y border-primary/10 ${className}`} aria-label="Vertrauenssignale">
      <div className="container-custom">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {trustItems.map(({ icon: Icon, value, label, sup }) => (
            <div key={label} className="flex flex-col sm:flex-row items-center sm:items-start gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xl font-bold text-primary leading-none">
                  {value}<sup className="text-xs font-normal text-muted-foreground ml-0.5">{sup}</sup>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6 flex flex-wrap justify-center gap-4">
          <span>🇨🇭 Schweizer Unternehmen</span>
          <span>🔒 SSL-verschlüsselt</span>
          <span>✅ DSGVO-konform</span>
          <span>⭐ Verifizierte Partnerfirmen</span>
        </p>
        <p className="text-center text-xs text-muted-foreground/70 mt-3">
          <sup>1</sup> Basierend auf Offerio-Plattformdaten und Kundenbefragungen (2024).{" "}
          <sup>2</sup> Durchschnitt aus verifizierten Nutzerbewertungen auf offerio.ch.
        </p>
      </div>
    </section>
  );
}
