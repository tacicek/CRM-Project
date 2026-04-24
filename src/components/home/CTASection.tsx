import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const CTASection = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const sectionRef = useRef<HTMLElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePosition({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePosition({ x: 0, y: 0 });
  };

  return (
    <section 
      ref={sectionRef}
      className="py-20 lg:py-28 bg-gradient-to-br from-secondary/10 via-background to-accent/10 overflow-hidden"
    >
      <div className="container-custom">
        <div 
          ref={cardRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/90 p-8 md:p-12 lg:p-16 text-primary-foreground transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-12 scale-95"
          }`}
          style={{
            transform: isVisible 
              ? `perspective(1000px) rotateX(${mousePosition.y * -5}deg) rotateY(${mousePosition.x * 5}deg) translateY(0)`
              : "perspective(1000px) translateY(48px) scale(0.95)",
            transition: "transform 0.3s ease-out, opacity 0.7s ease-out"
          }}
        >
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div 
              className={`absolute top-0 left-0 w-96 h-96 bg-secondary rounded-full blur-3xl transition-all duration-1000 ${
                isVisible ? "-translate-x-1/4 -translate-y-1/4" : "-translate-x-full -translate-y-full"
              }`}
              style={{
                transform: `translate(${-25 + mousePosition.x * 20}%, ${-25 + mousePosition.y * 20}%)`
              }}
            />
            <div 
              className={`absolute bottom-0 right-0 w-96 h-96 bg-accent rounded-full blur-3xl transition-all duration-1000 ${
                isVisible ? "translate-x-1/4 translate-y-1/4" : "translate-x-full translate-y-full"
              }`}
              style={{
                transform: `translate(${25 + mousePosition.x * -20}%, ${25 + mousePosition.y * -20}%)`
              }}
            />
            {/* Extra floating orb */}
            <div 
              className="absolute top-1/2 left-1/2 w-64 h-64 bg-primary-foreground/20 rounded-full blur-3xl"
              style={{
                transform: `translate(${-50 + mousePosition.x * 30}%, ${-50 + mousePosition.y * 30}%)`
              }}
            />
          </div>

          {/* Sparkle particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-2 h-2 bg-primary-foreground/30 rounded-full transition-all duration-1000 ${
                  isVisible ? "opacity-100" : "opacity-0"
                }`}
                style={{
                  left: `${15 + i * 15}%`,
                  top: `${20 + (i % 3) * 25}%`,
                  animationDelay: `${i * 0.2}s`,
                  animation: isVisible ? `float ${3 + i * 0.5}s ease-in-out infinite` : "none",
                  transitionDelay: `${i * 100 + 500}ms`
                }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center max-w-3xl mx-auto">
            <div 
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-foreground/10 text-sm font-medium mb-6 transition-all duration-700 hover:bg-primary-foreground/20 hover:scale-105 cursor-default ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ transitionDelay: "200ms" }}
            >
              <Sparkles className="w-4 h-4 animate-pulse" />
              100% Kostenlos & Unverbindlich
            </div>

            <h2 
              className={`text-3xl md:text-4xl lg:text-5xl font-bold mb-6 leading-tight transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "300ms" }}
            >
              Bereit für Ihren stressfreien Umzug?
            </h2>

            <p 
              className={`text-lg md:text-xl text-primary-foreground/80 mb-8 leading-relaxed transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "400ms" }}
            >
              Starten Sie jetzt und erhalten Sie innerhalb von 24 Stunden 
              bis zu 5 Offerten von verifizierten Schweizer Anbietern.
            </p>

            <div 
              className={`flex flex-col sm:flex-row gap-4 justify-center transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: "500ms" }}
            >
              <Button 
                size="xl" 
                className="bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1 transition-all duration-300"
                asChild
              >
                <Link to="/anfrage" className="group">
                  Jetzt Offerten erhalten
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
              <Button 
                size="xl" 
                variant="outline"
                className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:scale-105 hover:-translate-y-1 transition-all duration-300"
                asChild
              >
                <Link to="/so-funktioniert-es">Mehr erfahren</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.6; }
        }
      `}</style>
    </section>
  );
};

export default CTASection;