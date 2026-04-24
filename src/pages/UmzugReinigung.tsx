import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
    ArrowRight, CheckCircle2, Truck, Sparkles, Clock,
    Shield, Star, Users, BadgeCheck, Percent
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import TrustBar from "@/components/shared/TrustBar";

const UmzugReinigung = () => {
    const umzugReinigungFaqs = [
        {
            question: "Kann ich Umzug und Reinigung gleichzeitig anfragen?",
            answer: "Ja, genau das ist das Besondere an unserem Kombi-Service. Mit einer einzigen Anfrage erhalten Sie Offerten von Firmen, die beide Leistungen anbieten – das spart Zeit und Geld."
        },
        {
            question: "Spare ich wirklich bis zu 15% mit der Kombi-Anfrage?",
            answer: "Viele unserer Partnerfirmen bieten bei kombinierten Aufträgen (Umzug + Reinigung) Rabatte von 10–15% an, da sie die Leistungen effizienter koordinieren können."
        },
        {
            question: "Muss die gleiche Firma Umzug und Reinigung übernehmen?",
            answer: "Nein. Sie können die Leistungen auch an verschiedene Firmen vergeben. Offerio vermittelt für jede Leistung die besten Angebote – die Entscheidung liegt bei Ihnen."
        },
        {
            question: "Ist die Endreinigung mit Abnahmegarantie wirklich sicher?",
            answer: "Ja. Unsere Reinigungspartner bieten eine Abnahmegarantie: Wird bei der Wohnungsübergabe etwas beanstandet, reinigen sie kostenlos nach – ohne Aufpreis."
        },
        {
            question: "Wie schnell erhalte ich Offerten für Umzug und Reinigung?",
            answer: "In der Regel melden sich geprüfte Firmen innerhalb von 24 Stunden bei Ihnen – für beide Leistungen zusammen oder getrennt, ganz nach Ihrer Anfrage."
        }
    ];

    const umzugFeatures = [
        "Privatumzug & Firmenumzug",
        "Möbelmontage Ab-/Aufbau",
        "Versicherter Transport",
        "Verpackungsservice",
        "Zwischenlagerung möglich",
        "Flexible Terminwahl",
    ];

    const reinigungFeatures = [
        "Endreinigung mit Abnahmegarantie",
        "Grundreinigung & Fenster",
        "Professionelle Ausrüstung",
        "Ökologische Reinigungsmittel",
        "Nachbesserung inklusive",
        "Übergabe-Protokoll",
    ];

    const processSteps = [
        { icon: Users, title: "1. Anfrage stellen", desc: "Füllen Sie unser kurzes Formular aus — dauert nur 2 Minuten." },
        { icon: Clock, title: "2. Offerten erhalten", desc: "Innerhalb von 24h melden sich bis zu 5 geprüfte Firmen bei Ihnen." },
        { icon: BadgeCheck, title: "3. Vergleichen & wählen", desc: "Vergleichen Sie Preise, Leistungen und Bewertungen transparent." },
        { icon: Shield, title: "4. Stressfrei umziehen", desc: "Geniessen Sie Ihren Umzug — alles wird professionell erledigt." },
    ];

    return (
        <Layout>
            <Helmet>
                <title>Umzug und Reinigung kombinieren | Offerio — Bis zu 15% sparen</title>
                <meta
                    name="description"
                    content="Umzug und Endreinigung in einer Anfrage kombinieren. Bis zu 5 Offerten von geprüften Schweizer Firmen. Kombi-Rabatt bis 15%. Kostenlos & unverbindlich."
                />
                <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Umzug & Reinigung","item":"https://offerio.ch/umzug-reinigung"}]}`}</script>
                <script type="application/ld+json">{JSON.stringify({
                  "@context": "https://schema.org",
                  "@type": "FAQPage",
                  mainEntity: umzugReinigungFaqs.map(faq => ({
                    "@type": "Question",
                    name: faq.question,
                    acceptedAnswer: { "@type": "Answer", text: faq.answer }
                  }))
                })}</script>
            </Helmet>

            {/* Hero */}
            <section className="py-16 lg:py-24 bg-gradient-to-b from-primary/5 to-white">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto text-center">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-6">
                            <Percent className="w-4 h-4" />
                            Kombi-Rabatt bis 15% sparen
                        </div>
                        <h1 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                            Umzug <span style={{ color: '#EF6A17' }}>&</span> Reinigung —{" "}
                            <span className="block mt-2">alles in einer Anfrage</span>
                        </h1>
                        <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
                            Warum separat suchen? Offerio ist der einzige Schweizer Marktplatz,
                            auf dem Sie Umzug und Endreinigung kombiniert anfragen können.
                            Ein Formular, doppelt gespart.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Button variant="hero" size="lg" asChild>
                                <Link to="/anfrage" className="group">
                                    Jetzt Kombi-Offerte erhalten
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                            <Button variant="outline" size="lg" asChild>
                                <Link to="/so-funktioniert-es">So funktioniert's</Link>
                            </Button>
                        </div>

                        {/* Social Proof */}
                        <div className="flex items-center justify-center gap-4 mt-8">
                            <div className="flex">
                                {[...Array(5)].map((_, i) => (
                                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                                ))}
                            </div>
                            <span className="text-sm text-gray-600">
                                <strong>4.8 / 5</strong> aus 2'847 Bewertungen
                            </span>
                        </div>
                    </div>
                </div>
            </section>

            {/* Dual Service Cards */}
            <section className="py-16 bg-white">
                <div className="container mx-auto px-4">
                    <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                        {/* Umzug */}
                        <div className="bg-blue-50/50 rounded-2xl border border-blue-100 p-8">
                            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center mb-6">
                                <Truck className="w-7 h-7 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Umzug</h2>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                Von der 1-Zimmer-Wohnung bis zum Firmenumzug — unsere geprüften Partner
                                kümmern sich um alles.
                            </p>
                            <ul className="space-y-3 mb-6">
                                {umzugFeatures.map((f) => (
                                    <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                                        <CheckCircle2 className="w-5 h-5 text-blue-500 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/anfrage/umzug" className="inline-flex items-center gap-2 text-blue-600 font-semibold text-sm hover:text-blue-700 transition-colors">
                                Umzug-Offerte anfragen <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {/* Reinigung */}
                        <div className="bg-emerald-50/50 rounded-2xl border border-emerald-100 p-8">
                            <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center mb-6">
                                <Sparkles className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 mb-4">Reinigung</h2>
                            <p className="text-gray-600 mb-6 leading-relaxed">
                                Endreinigung mit Abnahmegarantie — damit Sie Ihre Kaution vollständig
                                zurückerhalten.
                            </p>
                            <ul className="space-y-3 mb-6">
                                {reinigungFeatures.map((f) => (
                                    <li key={f} className="flex items-center gap-3 text-sm text-gray-700">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                                        {f}
                                    </li>
                                ))}
                            </ul>
                            <Link to="/anfrage/reinigung" className="inline-flex items-center gap-2 text-emerald-600 font-semibold text-sm hover:text-emerald-700 transition-colors">
                                Reinigung-Offerte anfragen <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Kombi Advantage */}
                    <div className="max-w-3xl mx-auto mt-12 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl p-8 text-center">
                        <h3 className="text-xl font-bold text-gray-900 mb-3">
                            💡 Warum kombinieren?
                        </h3>
                        <div className="grid sm:grid-cols-3 gap-6 mt-6">
                            <div>
                                <div className="text-2xl font-bold" style={{ color: '#EF6A17' }}>Bis 15%<sup className="text-xs font-normal text-gray-500 ml-0.5">*</sup></div>
                                <div className="text-sm text-gray-600 mt-1">Kombi-Rabatt</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold" style={{ color: '#EF6A17' }}>1 Anfrage</div>
                                <div className="text-sm text-gray-600 mt-1">statt zwei separate</div>
                            </div>
                            <div>
                                <div className="text-2xl font-bold" style={{ color: '#EF6A17' }}>1 Termin</div>
                                <div className="text-sm text-gray-600 mt-1">weniger Koordination</div>
                            </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-6">
                            * Laut Rückmeldungen unserer Partnerfirmen bei kombinierten Umzugs- und Reinigungsaufträgen (Offerio-Daten 2024).{" "}
                            <a href="/preise" className="underline hover:text-gray-600">Transparente Preisübersicht →</a>
                        </p>
                    </div>
                </div>
            </section>

            {/* Process Steps */}
            <section className="py-16 bg-gray-50">
                <div className="container mx-auto px-4">
                    <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
                        So einfach funktioniert's
                    </h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto">
                        {processSteps.map((step, i) => (
                            <div key={i} className="text-center">
                                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                    <step.icon className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                                <p className="text-sm text-gray-600 leading-relaxed">{step.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Trust Bar */}
            <TrustBar />

            {/* FAQ Section */}
            <section className="py-16 lg:py-24 bg-muted/30">
                <div className="container mx-auto px-4 max-w-3xl">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-bold mb-4">Häufig gestellte Fragen</h2>
                        <p className="text-muted-foreground">Alles zum Thema Kombi-Anfrage für Umzug und Reinigung</p>
                    </div>
                    <Accordion type="single" collapsible className="w-full">
                        {umzugReinigungFaqs.map((faq, i) => (
                            <AccordionItem key={i} value={`faq-${i}`} className="border-b border-border">
                                <AccordionTrigger className="text-left font-medium py-4 hover:no-underline hover:text-primary">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed pb-4">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>
            </section>

            {/* Final CTA */}
            <section className="py-16 bg-primary text-white">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">
                        Bereit für einen stressfreien Umzug?
                    </h2>
                    <p className="text-white/80 max-w-xl mx-auto mb-8 text-lg">
                        Stellen Sie jetzt Ihre Kombi-Anfrage und erhalten Sie innerhalb von
                        24 Stunden bis zu 5 Offerten.
                    </p>
                    <Button
                        size="lg"
                        className="bg-white text-primary hover:bg-gray-100 font-semibold shadow-lg text-lg px-8"
                        asChild
                    >
                        <Link to="/anfrage" className="group">
                            Kostenlose Offerten erhalten
                            <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Link>
                    </Button>
                </div>
            </section>
        </Layout>
    );
};

export default UmzugReinigung;
