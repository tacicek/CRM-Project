import { Link } from "react-router-dom";
import { Mail, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { useState, useEffect, useRef } from "react";

const Footer = () => {
  const [isVisible, setIsVisible] = useState(false);
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (footerRef.current) {
      observer.observe(footerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const services = [
    { label: "Umzug", href: "/anfrage/umzug" },
    { label: "Reinigung", href: "/anfrage/reinigung" },
    { label: "Räumung", href: "/anfrage/raeumung" },
    { label: "Entsorgung", href: "/anfrage/raeumung" },
    { label: "Klaviertransport", href: "/anfrage/klaviertransport" },
    { label: "Möbellift", href: "/anfrage/moebellift" },
    { label: "Lagerung", href: "/anfrage/umzug" },
    { label: "Malerarbeit", href: "/anfrage/umzug" },
  ];

  const regionLinks = [
    { label: "Zürich", href: "/anfrage/umzug" },
    { label: "Bern", href: "/anfrage/umzug" },
    { label: "Basel", href: "/anfrage/umzug" },
    { label: "Luzern", href: "/anfrage/umzug" },
    { label: "St. Gallen", href: "/anfrage/umzug" },
    { label: "Winterthur", href: "/anfrage/umzug" },
  ];

  const ratgeberLinks = [
    { label: "Blog & Ratgeber", href: "/blog" },
    { label: "So funktionierts", href: "/so-funktioniert-es" },
    { label: "Preise", href: "/preise" },
    { label: "FAQ", href: "/#faq" },
  ];

  const aboutLinks = [
    { label: "Über uns", href: "/fuer-firmen" },
    { label: "Partner werden", href: "/partner-werden" },
    { label: "Kontakt", href: "mailto:info@offerio.ch" },
  ];

  const legalLinks = [
    { label: "Datenschutz", href: "/datenschutz" },
    { label: "AGB", href: "/agb" },
    { label: "Impressum", href: "/impressum" },
  ];

  const socialLinks = [
    { icon: Facebook, href: "#", label: "Facebook" },
    { icon: Instagram, href: "#", label: "Instagram" },
    { icon: Linkedin, href: "#", label: "LinkedIn" },
    { icon: Twitter, href: "#", label: "Twitter" },
  ];

  return (
    <footer
      ref={footerRef}
      className="relative bg-primary text-primary-foreground overflow-hidden w-screen -ml-[calc((100vw-100%)/2)]"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
      </div>

      <div className="container-custom relative z-10">
        {/* Main Footer Content */}
        <div className="pt-32 lg:pt-40 pb-16 lg:pb-20">
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-8">
            {/* Brand Column - full width on mobile */}
            <div
              className={`col-span-2 lg:col-span-3 space-y-6 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
            >
              <Link to="/" className="inline-block group">
                <img
                  src="/offerio-logo-v2.png"
                  alt="Offerio"
                  width={170}
                  height={40}
                  className="h-10 md:h-12 w-auto transition-transform duration-300 group-hover:scale-105"
                />
              </Link>
              <p className="text-sm text-primary-foreground/70 leading-relaxed max-w-sm">
                Die führende Plattform für Umzugs- und Reinigungsofferten in der Schweiz.
                Verbinden Sie sich mit verifizierten Dienstleistern und sparen Sie Zeit & Geld.
              </p>

              {/* Social Links */}
              <div className="flex items-center gap-3 pt-2">
                {socialLinks.map((social, index) => (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 rounded-xl bg-primary-foreground/10 flex items-center justify-center transition-all duration-300 hover:bg-secondary hover:scale-110 hover:-translate-y-1 group"
                  >
                    <social.icon className="w-5 h-5 text-primary-foreground/70 group-hover:text-primary-foreground transition-colors" />
                  </a>
                ))}
              </div>
            </div>

            {/* Services Column */}
            <div
              className={`lg:col-span-2 space-y-5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "100ms" }}
            >
              <h3 className="font-semibold text-lg">Dienstleistungen</h3>
              <ul className="space-y-3">
                {services.map((service, index) => (
                  <li key={index}>
                    <Link
                      to={service.href}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-all duration-300 inline-flex items-center gap-1 group"
                    >
                      <span className="relative">
                        {service.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-secondary transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Regions Column */}
            <div
              className={`lg:col-span-2 space-y-5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "150ms" }}
            >
              <h3 className="font-semibold text-lg">Regionen</h3>
              <ul className="space-y-3">
                {regionLinks.map((link, index) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-all duration-300 inline-flex items-center gap-1 group"
                    >
                      <span className="relative">
                        {link.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-secondary transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Ratgeber Column */}
            <div
              className={`lg:col-span-2 space-y-5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "200ms" }}
            >
              <h3 className="font-semibold text-lg">Ratgeber</h3>
              <ul className="space-y-3">
                {ratgeberLinks.map((link, index) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-all duration-300 inline-flex items-center gap-1 group"
                    >
                      <span className="relative">
                        {link.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-secondary transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* About Us Column */}
            <div
              className={`lg:col-span-3 space-y-5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
              style={{ transitionDelay: "250ms" }}
            >
              <h3 className="font-semibold text-lg">Über Uns</h3>
              <ul className="space-y-3 mb-6">
                {aboutLinks.map((link, index) => (
                  <li key={index}>
                    <Link
                      to={link.href}
                      className="text-sm text-primary-foreground/70 hover:text-primary-foreground transition-all duration-300 inline-flex items-center gap-1 group"
                    >
                      <span className="relative">
                        {link.label}
                        <span className="absolute bottom-0 left-0 w-0 h-px bg-secondary transition-all duration-300 group-hover:w-full" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>

              {/* Contact Info */}
              <div className="space-y-3 pt-4 border-t border-primary-foreground/10">
                <a
                  href="mailto:info@offerio.ch"
                  className="flex items-center gap-3 text-sm text-primary-foreground/70 hover:text-primary-foreground transition-colors"
                >
                  <Mail className="w-4 h-4" />
                  info@offerio.ch
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className={`py-6 border-t border-primary-foreground/10 transition-all duration-700 ${isVisible ? "opacity-100" : "opacity-0"
            }`}
          style={{ transitionDelay: "400ms" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-primary-foreground/50">
              © {new Date().getFullYear()} Offerio. Alle Rechte vorbehalten.
            </p>
            <div className="flex items-center gap-6">
              {legalLinks.map((link, index) => (
                <Link
                  key={index}
                  to={link.href}
                  className="text-sm text-primary-foreground/50 hover:text-primary-foreground transition-colors duration-300 relative group"
                >
                  {link.label}
                  <span className="absolute bottom-0 left-0 w-0 h-px bg-secondary transition-all duration-300 group-hover:w-full" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;