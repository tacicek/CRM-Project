import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Building2 } from "lucide-react";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "/", label: "Startseite" },
    { href: "/so-funktioniert-es", label: "So funktioniert's" },
    { href: "/fuer-firmen", label: "Für Firmen" },
    { href: "/preise", label: "Preise" },
    { href: "/blog", label: "Ratgeber" },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/50 transition-all duration-300 ${isScrolled ? "shadow-md" : ""
        }`}
    >
      <div className="container-custom">
        <nav className={`flex items-center justify-between transition-all duration-300 ${isScrolled ? "h-16 md:h-18" : "h-24 md:h-28"
          }`}>
          {/* Logo - Offerio */}
          <a href="https://offerio.ch" className="flex items-center group">
            <img
              src="/offerio-logo.png"
              alt="Offerio - Offerten vergleichen für Umzug und Reinigung"
              width={160}
              height={38}
              loading="eager"
              decoding="async"
              className={`transition-all duration-300 ${isScrolled ? "h-8 md:h-10" : "h-10 md:h-12"
                } w-auto`}
            />
          </a>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isActive(link.href)
                    ? "text-secondary bg-secondary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link
                to="/auth"
                className="flex items-center gap-2 hover:bg-secondary/15 hover:text-secondary hover:border-secondary/30"
              >
                <Building2 className="w-4 h-4" />
                Firma Login
              </Link>
            </Button>
            <Button variant="hero" size="sm" asChild>
              <Link to="/anfrage">Offerte anfragen</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-muted/50 transition-colors"
            aria-label={isMenuOpen ? "Menü schliessen" : "Menü öffnen"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </nav>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div
            id="mobile-menu"
            className="md:hidden absolute top-full left-0 right-0 bg-card border-b border-border shadow-lg z-50"
            role="menu"
          >
            <div className="px-4 py-4 flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-base font-medium transition-colors ${isActive(link.href)
                      ? "text-secondary bg-secondary/10"
                      : "text-foreground hover:bg-muted"
                    }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border mt-3">
                <Button variant="outline" className="justify-center w-full" asChild>
                  <Link to="/auth" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Firma Login
                  </Link>
                </Button>
                <Button variant="hero" className="w-full" asChild>
                  <Link to="/anfrage" onClick={() => setIsMenuOpen(false)}>Offerte anfragen</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;