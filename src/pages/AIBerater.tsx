import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mic,
  Clock,
  Shield,
  CheckCircle,
  ArrowRight,
  MessageSquare,
  Zap,
  Star,
  Bot,
  Volume2,
  ChevronDown,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// Vapi.ai widget script loader
declare global {
  interface Window {
    vapiSDK?: {
      run: (config: {
        apiKey: string;
        assistant: string;
        config?: {
          position?: string;
          width?: number;
          height?: number;
        };
      }) => void;
    };
  }
}

export default function AIBerater() {
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

  // Load Vapi.ai SDK
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.vapi.ai/vapi-web-sdk.js";
    script.async = true;
    script.onload = () => setIsWidgetLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const startCall = () => {
    const apiKey = import.meta.env.VITE_VAPI_PUBLIC_KEY;
    const assistantId = import.meta.env.VITE_VAPI_ASSISTANT_ID;

    if (window.vapiSDK && apiKey && assistantId) {
      setIsCallActive(true);
      window.vapiSDK.run({
        apiKey,
        assistant: assistantId,
        config: {
          position: "bottom-right",
          width: 400,
          height: 600,
        },
      });
    } else {
      // Fallback: Open phone link
      window.location.href = "tel:+41445001234";
    }
  };

  const benefits = [
    {
      icon: Clock,
      title: "2-3 Minuten statt 10+",
      description: "Schneller als jedes Formular – einfach sprechen!",
    },
    {
      icon: MessageSquare,
      title: "Natürliches Gespräch",
      description: "Wie ein freundlicher Berater, der Ihre Sprache spricht",
    },
    {
      icon: Shield,
      title: "100% Datenschutz",
      description: "Ihre Daten sind sicher nach Schweizer Standard (FADP)",
    },
    {
      icon: Zap,
      title: "Sofort Offerten",
      description: "Bis zu 5 Angebote innerhalb von 24 Stunden",
    },
  ];

  const steps = [
    {
      number: 1,
      title: "Anrufen",
      description: "Klicken Sie auf den Button und starten Sie das Gespräch",
    },
    {
      number: 2,
      title: "Erzählen",
      description: "Beschreiben Sie kurz Ihren Umzug oder Service-Wunsch",
    },
    {
      number: 3,
      title: "Offerten erhalten",
      description: "Qualifizierte Firmen melden sich bei Ihnen",
    },
  ];

  const faqs = [
    {
      question: "Ist der KI-Assistent wirklich kostenlos?",
      answer: "Ja, der Service ist für Sie als Kunde komplett kostenlos. Sie erhalten unverbindliche Offerten von qualifizierten Umzugsfirmen.",
    },
    {
      question: "Wie funktioniert die Spracherkennung?",
      answer: "Unser KI-Assistent versteht Hochdeutsch und Schweizerdeutsch. Sprechen Sie einfach natürlich – der Assistent stellt bei Bedarf Rückfragen.",
    },
    {
      question: "Was passiert mit meinen Daten?",
      answer: "Ihre Daten werden gemäss Schweizer Datenschutzgesetz (FADP) verarbeitet und nur für die Vermittlung von Offerten verwendet. Sie können jederzeit die Löschung verlangen.",
    },
    {
      question: "Kann ich auch ein Formular ausfüllen?",
      answer: "Natürlich! Wenn Sie lieber tippen, können Sie auch unser klassisches Anfrageformular nutzen.",
    },
  ];

  return (
    <>
      <Helmet>
        <title>KI-Berater für Umzugsofferten | Offerio.ch</title>
        <meta
          name="description"
          content="Erhalten Sie in 2-3 Minuten bis zu 5 Umzugsofferten – einfach durch ein Gespräch mit unserem KI-Assistenten. Kostenlos und unverbindlich!"
        />
        <meta name="keywords" content="KI Assistent, Umzug Schweiz, Umzugsofferte, Voice AI, Sprachassistent" />
        <link rel="canonical" href="https://offerio.ch/ai-berater" />

        {/* Open Graph */}
        <meta property="og:title" content="KI-Berater für Umzugsofferten | Offerio.ch" />
        <meta property="og:description" content="Erhalten Sie in 2-3 Minuten bis zu 5 Umzugsofferten – einfach durch ein Gespräch mit unserem KI-Assistenten." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://offerio.ch/ai-berater" />

        {/* Schema.org */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "KI-Berater für Umzugsofferten",
            "description": "Erhalten Sie in 2-3 Minuten bis zu 5 Umzugsofferten durch ein Gespräch mit unserem KI-Assistenten.",
            "url": "https://offerio.ch/ai-berater",
            "provider": {
              "@type": "Organization",
              "name": "Offerio.ch",
              "url": "https://offerio.ch"
            }
          })}
        </script>
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"KI-Berater","item":"https://offerio.ch/ai-berater"}]}`}</script>
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map(faq => ({
            "@type": "Question",
            name: faq.question,
            acceptedAnswer: { "@type": "Answer", text: faq.answer }
          }))
        })}</script>
      </Helmet>

      <Header />

      <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 lg:py-32">
          {/* Background Pattern */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.1),transparent_50%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.08),transparent_50%)]" />
          </div>

          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Content */}
              <div className="space-y-8">
                <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-4 py-1.5">
                  <Bot className="w-4 h-4 mr-2" />
                  NEU: KI-Sprachassistent
                </Badge>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white leading-tight">
                  Umzugsofferte in{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                    2-3 Minuten
                  </span>
                </h1>

                <p className="text-xl text-slate-600 dark:text-slate-300 max-w-xl">
                  Kein Formular ausfüllen – einfach mit unserem KI-Assistenten sprechen und
                  bis zu 5 unverbindliche Offerten von qualifizierten Schweizer Umzugsfirmen erhalten.
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    size="lg"
                    onClick={startCall}
                    disabled={!isWidgetLoaded}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all group"
                  >
                    <Phone className="w-5 h-5 mr-2 group-hover:animate-pulse" />
                    {isCallActive ? "Gespräch läuft..." : "Jetzt Kostenlos Anrufen"}
                  </Button>

                  <Link to="/umzug">
                    <Button
                      variant="outline"
                      size="lg"
                      className="px-8 py-6 text-lg rounded-xl border-2"
                    >
                      Formular ausfüllen
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>

                {/* Trust Indicators */}
                <div className="flex items-center gap-6 pt-4">
                  <div className="flex -space-x-2">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 border-2 border-white dark:border-slate-800 flex items-center justify-center text-white text-xs font-bold"
                      >
                        {String.fromCharCode(64 + i)}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      5'000+ zufriedene Kunden
                    </p>
                  </div>
                </div>
              </div>

              {/* Right: Visual */}
              <div className="relative">
                <div className="relative bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 rounded-3xl p-8 border border-blue-100 dark:border-blue-900/50">
                  {/* Voice Animation */}
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                        <Mic className="w-16 h-16 text-white" />
                      </div>
                      {/* Pulse Animation */}
                      <div className="absolute inset-0 rounded-full bg-blue-500/30 animate-ping" />
                      <div className="absolute inset-0 rounded-full bg-purple-500/20 animate-pulse" />
                    </div>
                  </div>

                  {/* Sample Conversation */}
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Grüezi! Ich bin Ihr digitaler Umzugsberater. Wie kann ich Ihnen helfen?
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl rounded-tr-none px-4 py-3 shadow-sm">
                        <p className="text-sm text-white">
                          Ich ziehe von Zürich nach Bern...
                        </p>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                        <Volume2 className="w-4 h-4 text-slate-500" />
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="bg-white dark:bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          Sehr gut! Wie viele Zimmer hat Ihre aktuelle Wohnung?
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-4 -right-4 bg-green-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-semibold">Kostenlos</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-20 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Warum KI-Berater?
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Schneller, einfacher und persönlicher als jedes Online-Formular
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <Card key={index} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
                      <benefit.icon className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {benefit.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section className="py-20 bg-slate-50 dark:bg-slate-950">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                So einfach geht's
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {steps.map((step, index) => (
                <div key={index} className="relative text-center">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold shadow-lg">
                    {step.number}
                  </div>
                  <h3 className="font-bold text-xl text-slate-900 dark:text-white mb-2">
                    {step.title}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-400">
                    {step.description}
                  </p>

                  {/* Connector Line */}
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-blue-300 to-purple-300 dark:from-blue-700 dark:to-purple-700" />
                  )}
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="text-center mt-12">
              <Button
                size="lg"
                onClick={startCall}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-10 py-6 text-lg rounded-xl shadow-lg"
              >
                <Mic className="w-5 h-5 mr-2" />
                Jetzt starten – kostenlos
              </Button>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-20 bg-white dark:bg-slate-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-4">
                Häufige Fragen
              </h2>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={index}
                  className="group bg-slate-50 dark:bg-slate-800 rounded-xl overflow-hidden"
                >
                  <summary className="flex items-center justify-between cursor-pointer p-6 font-semibold text-slate-900 dark:text-white">
                    {faq.question}
                    <ChevronDown className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="px-6 pb-6 text-slate-600 dark:text-slate-400">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Bereit für Ihre Offerten?
            </h2>
            <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
              Starten Sie jetzt ein Gespräch mit unserem KI-Assistenten und erhalten Sie
              innerhalb von 24 Stunden bis zu 5 unverbindliche Offerten.
            </p>
            <Button
              size="lg"
              onClick={startCall}
              className="bg-white text-blue-600 hover:bg-slate-100 px-10 py-6 text-lg rounded-xl shadow-lg font-semibold"
            >
              <Phone className="w-5 h-5 mr-2" />
              Kostenlos anrufen
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
