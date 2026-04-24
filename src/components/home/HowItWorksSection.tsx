import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClipboardList, Send, BarChart3, Handshake, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const HowItWorksSection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const steps = [
    {
      icon: ClipboardList,
      step: "01",
      title: "Anfrage stellen",
      description: "Füllen Sie in wenigen Minuten unser einfaches Formular aus und beschreiben Sie Ihren Bedarf detailliert.",
    },
    {
      icon: Send,
      step: "02",
      title: "Offerten erhalten",
      description: "Innerhalb von 24 Stunden erhalten Sie bis zu 5 Offerten von geprüften und versicherten Anbietern.",
    },
    {
      icon: BarChart3,
      step: "03",
      title: "Vergleichen & entscheiden",
      description: "Vergleichen Sie Preise, Leistungen und Bewertungen. Kontaktieren Sie die Firmen direkt bei Fragen.",
    },
    {
      icon: Handshake,
      step: "04",
      title: "Auftrag erteilen",
      description: "Wählen Sie das beste Angebot und beauftragen Sie den Dienstleister Ihrer Wahl – ohne versteckte Kosten.",
    },
  ];

  return (
    <section 
      ref={sectionRef}
      className="py-20 lg:py-28 bg-gradient-to-b from-muted/30 to-background overflow-hidden"
      aria-labelledby="how-it-works-heading"
    >
      <div className="container-custom">
        {/* Header */}
        <header className={`text-center max-w-2xl mx-auto mb-16 transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <h2 id="how-it-works-heading" className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            So einfach funktioniert's
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            In nur 4 Schritten zu Ihrem perfekten Dienstleister – 
            100% kostenlos und unverbindlich für Sie.
          </p>
        </header>

        {/* Steps */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {steps.map((step, index) => (
            <article 
              key={index} 
              className={`relative group transition-all duration-700 ${
                isVisible 
                  ? "opacity-100 translate-y-0" 
                  : "opacity-0 translate-y-12"
              }`}
              style={{ transitionDelay: `${index * 150 + 200}ms` }}
            >
              {/* Connector Line with animation */}
              {index < steps.length - 1 && (
                <div 
                  className={`hidden lg:block absolute top-10 left-[60%] h-0.5 bg-gradient-to-r from-primary/50 to-primary/20 transition-all duration-1000 ${
                    isVisible ? "w-full opacity-100" : "w-0 opacity-0"
                  }`}
                  style={{ transitionDelay: `${index * 150 + 600}ms` }}
                  aria-hidden="true" 
                />
              )}
              
              <div className="relative bg-card rounded-2xl p-6 border border-border/50 hover:border-primary/30 transition-all duration-500 h-full hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2 group">
                {/* Step Number with pulse animation */}
                <div className={`absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-md transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/30 ${
                  isVisible ? "scale-100 opacity-100" : "scale-0 opacity-0"
                }`}
                style={{ transitionDelay: `${index * 150 + 400}ms` }}
                >
                  {step.step}
                </div>
                
                {/* Icon with hover animation */}
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5 transition-all duration-500 group-hover:bg-primary group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-lg group-hover:shadow-primary/20">
                  <step.icon className="w-8 h-8 text-primary transition-colors duration-500 group-hover:text-primary-foreground" strokeWidth={1.5} />
                </div>
                
                <h3 className="text-lg font-semibold mb-2 text-foreground group-hover:text-primary transition-colors duration-300">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed group-hover:text-foreground/70 transition-colors duration-300">
                  {step.description}
                </p>

                {/* Hover glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/0 to-secondary/0 group-hover:from-primary/5 group-hover:to-secondary/10 transition-all duration-500 pointer-events-none" />
              </div>
            </article>
          ))}
        </div>

        {/* CTA with animation */}
        <div className={`text-center transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}
        style={{ transitionDelay: "800ms" }}
        >
          <Button variant="hero" size="xl" asChild className="group">
            <Link to="/anfrage">
              Jetzt kostenlos starten
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;