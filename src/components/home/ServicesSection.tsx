import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { services } from "@/data/services";

// Import optimized WebP service images
import umzugImg from "@/assets/service-umzug.webp";
import reinigungImg from "@/assets/service-reinigung.webp";
import raeumungImg from "@/assets/service-raeumung.webp";
import klavierImg from "@/assets/service-klavier.webp";
import lagerungImg from "@/assets/service-lagerung.webp";
import entsorgungImg from "@/assets/service-entsorgung.webp";

const ServicesSection = () => {
  // Map images to service IDs
  const serviceImages: Record<string, string> = {
    umzug: umzugImg,
    reinigung: reinigungImg,
    raeumung: raeumungImg,
    klaviertransport: klavierImg,
    moebellift: entsorgungImg, // Using entsorgung image as fallback/placeholder if specific one not available
    lagerung: lagerungImg,
  };

  return (
    <section 
      className="py-20 lg:py-28 bg-background"
      aria-labelledby="services-heading"
    >
      <div className="container-custom">
        {/* Header */}
        <header className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="services-heading" className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Alle Dienstleistungen,{" "}
            <span className="text-primary">eine Plattform</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Von der Planung bis zur Ausführung – finden Sie den perfekten 
            Dienstleister für Ihren Bedarf. Alle Partner sind verifiziert und versichert.
          </p>
        </header>

        {/* Services Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {services.map((service, index) => (
            <Link
              key={service.id}
              to={service.link}
              className="group glass-card overflow-hidden cursor-pointer border border-border/50 hover:border-primary/30 transition-all duration-500 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-2"
              aria-label={`Offerte für ${service.title} anfragen`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img 
                  src={serviceImages[service.id] || umzugImg} 
                  alt={service.description}
                  className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent opacity-80 group-hover:opacity-60 transition-opacity duration-500" />
                
                {/* Icon Badge */}
                <div className="absolute bottom-4 left-4 w-12 h-12 rounded-xl bg-card/90 backdrop-blur-sm flex items-center justify-center shadow-lg transition-all duration-500 group-hover:scale-110 group-hover:bg-primary group-hover:shadow-primary/30">
                  <service.icon className="w-6 h-6 text-primary transition-colors duration-500 group-hover:text-primary-foreground" strokeWidth={1.5} />
                </div>

                {/* Hover overlay glow */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-primary/0 group-hover:from-primary/5 group-hover:to-accent/10 transition-all duration-500" />
              </div>

              {/* Content */}
              <div className="p-6 relative">
                {/* Animated background on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/0 to-accent/0 group-hover:from-primary/3 group-hover:to-accent/5 transition-all duration-500" />
                
                <div className="relative">
                  <h3 className="text-xl font-semibold mb-2 text-foreground group-hover:text-primary transition-colors duration-300">
                    {service.title}
                  </h3>
                  <p className="text-muted-foreground mb-4 leading-relaxed text-sm group-hover:text-foreground/80 transition-colors duration-300 min-h-[60px]">
                    {service.description}
                  </p>
                  
                  {/* Features */}
                  <ul className="space-y-2 mb-4">
                    {service.features.map((feature, idx) => (
                      <li 
                        key={idx} 
                        className="flex items-center gap-2 text-sm text-muted-foreground group-hover:text-foreground/70 transition-all duration-300"
                        style={{ transitionDelay: `${idx * 50}ms` }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 transition-all duration-300 group-hover:w-2 group-hover:h-2 group-hover:bg-primary" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center gap-2 text-primary text-sm font-medium translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                    <span>Offerte anfragen</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" strokeWidth={1.5} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ServicesSection;