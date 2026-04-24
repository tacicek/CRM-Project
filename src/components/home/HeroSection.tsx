import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, BadgeCheck, ShieldCheck, Timer, Star } from "lucide-react";
import { services } from "@/data/services";

const HeroSection = () => {
  const benefits = [
    { icon: BadgeCheck, text: "Kostenlos" },
    { icon: ShieldCheck, text: "Unverbindlich" },
    { icon: Timer, text: "In 24h" },
  ];

  const mainServices = services.filter(s =>
    ["umzug", "reinigung", "raeumung", "klaviertransport", "moebellift", "spezialtransport"].includes(s.id)
  );

  return (
    <section
      aria-labelledby="hero-heading"
      className="w-screen -ml-[calc((100vw-100%)/2)]"
    >
      {/* ============================================
          MOBILE LAYOUT: Content first, then image
          ============================================ */}
      <div className="md:hidden">
        {/* Mobile Content */}
        <div className="bg-white px-4 py-8">
          {/* USP Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-full text-xs font-semibold mb-4">
            🇨🇭 Der einzige Schweizer Marktplatz für Umzug UND Reinigung
          </div>

          <h1
            id="hero-heading"
            aria-hidden="true"
            className="text-2xl font-bold leading-tight text-gray-900 mb-4"
          >
            Umzugsofferten einholen ist zeitraubend —{" "}
            <span style={{ color: '#EF6A17' }}>wir erledigen das für Sie</span>
          </h1>

          <p className="text-sm text-gray-600 leading-relaxed mb-6">
            Bis zu 5 verifizierte Umzugs- <strong>und Reinigungsunternehmen</strong> melden
            sich innerhalb von 24h. Kostenlos, unverbindlich, ohne Telefonstress.
          </p>

          {/* Service Selector Box */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4 text-center">Was suchen Sie?</h2>

            <div className="grid grid-cols-3 gap-2 mb-6">
              {mainServices.map((service) => (
                <Link
                  key={service.id}
                  to={service.link}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-primary transition-all duration-200 group text-center"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-200">
                    <service.icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-gray-700 group-hover:text-primary text-[11px] leading-tight transition-colors duration-200">{service.title}</span>
                </Link>
              ))}
            </div>

            <Button variant="hero" size="lg" className="w-full shadow-md text-sm" asChild>
              <Link to="/anfrage" className="group">
                Jetzt kostenlose Offerten erhalten
                <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Trust Signals */}
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
                <benefit.icon className="w-4 h-4 text-secondary" strokeWidth={2.5} />
                <span className="text-gray-700 text-xs font-medium">{benefit.text}</span>
              </div>
            ))}
          </div>

          {/* Social Proof */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <span className="font-semibold">4.8/5</span>
            <span>von 2'847 Bewertungen</span>
          </div>
          <p className="text-xs text-gray-400 text-center mt-1">Verifizierte Nutzerbewertungen auf offerio.ch (2024)</p>

          {/* Provider Teaser */}
          <div className="mt-6 pt-4 border-t border-gray-200 text-center">
            <p className="text-xs text-gray-500">
              Sind Sie ein Umzugs- oder Reinigungsunternehmen?{" "}
              <Link to="/partner-werden" className="text-primary font-semibold hover:underline">
                Jetzt Partner werden →
              </Link>
            </p>
          </div>
        </div>

        {/* Mobile Hero Image */}
        <div className="relative h-48 overflow-hidden">
          <img
            src="/hero-moving-sm.webp"
            alt="Professionelle Umzugshelfer in einer modernen Schweizer Wohnung"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
            width={640}
            height={192}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        </div>
      </div>

      {/* ============================================
          DESKTOP LAYOUT: Image as background (original)
          ============================================ */}
      <div className="hidden md:block relative overflow-hidden min-h-[75vh] lg:min-h-[80vh]">
        {/* Desktop Background Image */}
        <img
          src="/hero-moving.webp"
          srcSet="/hero-moving-md.webp 1280w, /hero-moving.webp 1920w"
          sizes="100vw"
          alt="Professionelle Umzugshelfer in einer modernen Schweizer Wohnung mit Alpenblick"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          // @ts-expect-error - React 19+ uses fetchPriority, older versions need lowercase
          fetchpriority="high"
          decoding="async"
        />

        {/* Dark overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/60 to-black/50" />

        {/* Floating Statistics Badge - Only on Desktop */}
        <div className="absolute top-6 right-6 bg-white/95 backdrop-blur-sm px-4 py-3 rounded-xl shadow-2xl border-l-4 border-l-primary animate-fade-in hidden xl:block">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center font-bold text-gray-600 text-xs">JD</div>
              <div className="w-8 h-8 rounded-full bg-gray-300 border-2 border-white flex items-center justify-center font-bold text-gray-600 text-xs">KM</div>
              <div className="w-8 h-8 rounded-full bg-primary text-white border-2 border-white flex items-center justify-center font-bold text-xs">+5k</div>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-base">5'000+</div>
              <div className="text-xs text-gray-500 font-medium">Anfragen</div>
            </div>
          </div>
        </div>

        {/* Desktop Content */}
        <div className="container-custom relative z-10 py-16 lg:py-20 flex items-center min-h-[75vh] lg:min-h-[80vh]">
          <div className="max-w-3xl">
            {/* USP Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 backdrop-blur-sm text-white rounded-full text-sm font-medium mb-6 animate-fade-in border border-white/20">
              🇨🇭 Der einzige Schweizer Marktplatz für Umzug UND Reinigung
            </div>

            {/* aria-hidden: the real H1 is in the mobile layout above (same text, one H1 per page for SEO) */}
            <h1
              className="text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-white mb-6 animate-fade-in-up drop-shadow-lg"
            >
              Umzugsofferten einholen ist zeitraubend —<br className="hidden sm:block" />
              <span className="drop-shadow-lg" style={{ color: '#EF6A17' }}>wir erledigen das für Sie</span>
            </h1>

            <p className="text-base md:text-lg text-gray-100 leading-relaxed mb-8 animate-fade-in-up delay-100 drop-shadow-md max-w-2xl">
              Bis zu 5 verifizierte Umzugs- <strong>und Reinigungsunternehmen</strong> melden
              sich innerhalb von 24h. Kostenlos, unverbindlich, ohne Telefonstress.
            </p>

            {/* Service Selector Box */}
            <div className="bg-white/10 backdrop-blur-md shadow-2xl rounded-2xl p-7 animate-fade-in-up delay-200 max-w-2xl border border-white/20">
              <h2 className="text-lg font-semibold text-white mb-6 text-center">Was suchen Sie?</h2>

              <div className="grid grid-cols-3 gap-3 mb-8">
                {mainServices.map((service) => (
                  <Link
                    key={service.id}
                    to={service.link}
                    className="flex flex-col items-center justify-center gap-2 p-3 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-xl hover:scale-105 hover:border-primary transition-all duration-300 group text-center"
                  >
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                      <service.icon className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-gray-700 group-hover:text-primary text-xs leading-tight transition-colors duration-300">{service.title}</span>
                  </Link>
                ))}
              </div>

              <Button variant="hero" size="lg" className="w-full shadow-lg hover:shadow-xl transition-shadow text-base" asChild>
                <Link to="/anfrage" className="group">
                  Jetzt kostenlose Offerten erhalten
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </Button>
            </div>

            {/* Trust + Social Proof Row */}
            <div className="flex flex-wrap items-center gap-6 mt-8 animate-fade-in-up delay-300">
              {/* Benefits */}
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 bg-gray-900/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                  <benefit.icon className="w-5 h-5" style={{ color: '#EF6A17' }} strokeWidth={2.5} />
                  <span className="text-white text-sm font-medium tracking-wide">{benefit.text}</span>
                </div>
              ))}

              {/* Social Proof Badge */}
              <div className="flex items-center gap-2 bg-gray-900/40 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <span className="text-white text-sm font-medium">4.8/5</span>
                <span className="text-white/70 text-sm">• 2'847 Bewertungen</span>
              </div>
            </div>
            <p className="text-xs text-white/40 mt-2 animate-fade-in-up delay-300">Verifizierte Nutzerbewertungen auf offerio.ch (2024)</p>

            {/* Provider Teaser */}
            <div className="mt-6 animate-fade-in-up delay-300">
              <p className="text-sm text-white/60">
                Sind Sie ein Umzugs- oder Reinigungsunternehmen?{" "}
                <Link to="/partner-werden" className="text-white/90 font-semibold hover:text-white underline underline-offset-2">
                  Jetzt Partner werden →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;