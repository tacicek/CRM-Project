import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Truck, Sparkles, CheckCircle2 } from "lucide-react";

const DualVerticalSection = () => {
    return (
        <section className="py-16 lg:py-24 bg-gradient-to-b from-white to-gray-50">
            <div className="container mx-auto px-4">
                {/* Section Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-full text-sm font-semibold mb-4">
                        🇨🇭 Exklusiv bei Offerio
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                        Umzug <span style={{ color: '#EF6A17' }}>&</span> Reinigung — alles aus einer Hand
                    </h2>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                        Offerio ist der einzige Schweizer Marktplatz, auf dem Sie Umzug und Endreinigung
                        in einer Anfrage kombinieren können. Ein Formular, doppelt gespart.
                    </p>
                </div>

                {/* Two Column Cards */}
                <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto mb-12">
                    {/* Umzug Card */}
                    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow p-8 group">
                        <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Truck className="w-7 h-7 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Umzug</h3>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                            Privatumzug, Firmenumzug oder Büroumzug — vergleichen Sie bis zu 5 Offerten
                            von geprüften Umzugsfirmen in Ihrer Region.
                        </p>
                        <ul className="space-y-2 mb-6">
                            {["Festpreisgarantie", "Versicherte Transporte", "Ab-/Aufbau inklusive", "Flexible Termine"].map((item) => (
                                <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <Button variant="outline" size="sm" asChild className="group/btn">
                            <Link to="/anfrage/umzug">
                                Umzugsofferten vergleichen
                                <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                    </div>

                    {/* Reinigung Card */}
                    <div className="relative bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-shadow p-8 group">
                        <div className="w-14 h-14 rounded-xl bg-emerald-50 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                            <Sparkles className="w-7 h-7 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">Reinigung</h3>
                        <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                            Endreinigung, Grundreinigung oder Büroreinigung — erhalten Sie Offerten
                            von verifizierten Reinigungsfirmen mit Abnahmegarantie.
                        </p>
                        <ul className="space-y-2 mb-6">
                            {["Abnahmegarantie", "Professionelle Ausrüstung", "Flexible Buchung", "Ökologische Reinigung"].map((item) => (
                                <li key={item} className="flex items-center gap-2 text-sm text-gray-700">
                                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                                    {item}
                                </li>
                            ))}
                        </ul>
                        <Button variant="outline" size="sm" asChild className="group/btn">
                            <Link to="/anfrage/reinigung">
                                Reinigungsofferten vergleichen
                                <ArrowRight className="ml-2 w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Combined CTA */}
                <div className="max-w-3xl mx-auto">
                    <div className="relative bg-gradient-to-r from-primary to-primary/90 rounded-2xl p-8 md:p-10 text-white text-center overflow-hidden">
                        {/* Decorative elements */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

                        <div className="relative z-10">
                            <h3 className="text-2xl md:text-3xl font-bold mb-3">
                                Umzug + Reinigung kombinieren & sparen
                            </h3>
                            <p className="text-white/80 mb-6 max-w-xl mx-auto">
                                Stellen Sie eine kombinierte Anfrage und erhalten Sie Offerten für beides.
                                Viele unserer Partner bieten Kombi-Rabatte von bis zu 15%.
                            </p>
                            <Button
                                size="lg"
                                className="bg-white text-primary hover:bg-gray-100 font-semibold shadow-lg"
                                asChild
                            >
                                <Link to="/umzug-reinigung" className="group">
                                    Kombi-Offerte anfragen
                                    <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default DualVerticalSection;
