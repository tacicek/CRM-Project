import { ShieldCheck, Award, Timer, Users, Star, ThumbsUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const TrustSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [countStarted, setCountStarted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          setTimeout(() => setCountStarted(true), 300);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const stats = [
    { icon: Users, value: "50'000+", label: "Zufriedene Kunden", numValue: 50000 },
    { icon: Award, value: "500+", label: "Verifizierte Partner", numValue: 500 },
    { icon: Star, value: "4.8/5", label: "Durchschnittliche Bewertung", numValue: 4.8 },
    { icon: ThumbsUp, value: "98%", label: "Weiterempfehlungsrate", numValue: 98 },
  ];

  const trustPoints = [
    {
      icon: ShieldCheck,
      title: "Verifizierte Partner",
      description: "Jeder Partner wird auf Zuverlässigkeit, Versicherungsschutz und Servicequalität geprüft, bevor er auf unserer Plattform zugelassen wird.",
    },
    {
      icon: Timer,
      title: "Schnelle Rückmeldung",
      description: "Erhalten Sie innerhalb von 24 Stunden bis zu 5 detaillierte Offerten von qualifizierten Anbietern in Ihrer Region.",
    },
    {
      icon: Star,
      title: "Transparente Bewertungen",
      description: "Echte Kundenbewertungen und verifizierte Erfahrungsberichte helfen Ihnen bei der richtigen Entscheidung.",
    },
  ];

  // Animated counter hook
  const useCounter = (end: number, duration: number = 2000, start: boolean = false) => {
    const [count, setCount] = useState(0);
    
    useEffect(() => {
      if (!start) return;
      
      let startTime: number;
      let animationFrame: number;
      
      const animate = (timestamp: number) => {
        if (!startTime) startTime = timestamp;
        const progress = Math.min((timestamp - startTime) / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        setCount(easeOutQuart * end);
        
        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };
      
      animationFrame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(animationFrame);
    }, [end, duration, start]);
    
    return count;
  };

  const CounterDisplay = ({ stat, index }: { stat: typeof stats[0], index: number }) => {
    const count = useCounter(stat.numValue, 2000, countStarted);
    
    const formatValue = () => {
      if (stat.value.includes("/5")) {
        return count.toFixed(1) + "/5";
      } else if (stat.value.includes("%")) {
        return Math.round(count) + "%";
      } else if (stat.value.includes("'")) {
        return Math.round(count).toLocaleString('de-CH') + "+";
      }
      return Math.round(count) + "+";
    };

    return (
      <div 
        className={`text-center transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
        style={{ transitionDelay: `${index * 100}ms` }}
      >
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center mx-auto mb-4 transition-all duration-500 hover:scale-110 hover:from-secondary/30 hover:to-accent/30 hover:rotate-3 group cursor-default">
          <stat.icon className="w-7 h-7 text-white transition-transform duration-300 group-hover:scale-110" strokeWidth={2} />
        </div>
        <div className="text-3xl md:text-4xl font-bold mb-1 tabular-nums">
          {formatValue()}
        </div>
        <div className="text-sm text-primary-foreground/70">{stat.label}</div>
      </div>
    );
  };

  return (
    <section 
      ref={sectionRef}
      className="py-20 lg:py-28 bg-primary text-primary-foreground overflow-hidden"
      aria-labelledby="trust-heading"
    >
      <div className="container-custom">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-4">
          {stats.map((stat, index) => (
            <CounterDisplay key={index} stat={stat} index={index} />
          ))}
        </div>
        <p className={`text-center text-xs text-primary-foreground/50 mb-16 transition-all duration-700 ${isVisible ? "opacity-100" : "opacity-0"}`}>
          Alle Angaben basieren auf Offerio-Plattformdaten und verifizierten Nutzerbewertungen (2024).
        </p>

        {/* Header */}
        <header className={`text-center max-w-2xl mx-auto mb-12 transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
        style={{ transitionDelay: "400ms" }}
        >
          <h2 id="trust-heading" className="text-3xl md:text-4xl font-bold mb-4">
            Warum Offerio vertrauen?
          </h2>
          <p className="text-lg text-primary-foreground/80 leading-relaxed">
            Seit Jahren verbinden wir Kunden mit den besten Dienstleistern der Schweiz.
          </p>
        </header>

        {/* Trust Points */}
        <div className="grid md:grid-cols-3 gap-8">
          {trustPoints.map((point, index) => (
            <article 
              key={index}
              className={`p-6 rounded-2xl bg-primary-foreground/5 border border-primary-foreground/10 transition-all duration-500 hover:bg-primary-foreground/10 hover:-translate-y-2 hover:shadow-xl hover:shadow-black/20 group cursor-default ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 150 + 500}ms` }}
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-accent/20 flex items-center justify-center mb-4 transition-all duration-500 group-hover:from-secondary/40 group-hover:to-accent/40 group-hover:scale-110 group-hover:rotate-6 group-hover:shadow-lg group-hover:shadow-accent/30">
                <point.icon className="w-6 h-6 text-white transition-colors duration-500 group-hover:text-white" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-semibold mb-3 transition-colors duration-300 group-hover:text-secondary">{point.title}</h3>
              <p className="text-primary-foreground/70 leading-relaxed transition-colors duration-300 group-hover:text-primary-foreground/90">
                {point.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TrustSection;