import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const faqs = [
  {
    question: "Wie werde ich Partner bei Offerio?",
    answer:
      "Die Registrierung dauert nur wenige Minuten. Füllen Sie das Partnerformular aus, wir prüfen Ihre Firma und schalten Sie frei. Danach können Sie sofort Anfragen empfangen.",
  },
  {
    question: "Was kostet die Mitgliedschaft als Partnerfirma?",
    answer:
      "Es gibt keine monatlichen Grundgebühren oder Abo-Zwang. Sie kaufen Token-Pakete und zahlen nur für Leads, die Sie wirklich interessieren. So haben Sie volle Kostenkontrolle.",
  },
  {
    question: "Wie erhalte ich Kundenanfragen?",
    answer:
      "Sobald ein Kunde eine Anfrage passend zu Ihrem Leistungsbereich und Ihrer Region stellt, werden Sie sofort per E-Mail benachrichtigt. Sie entscheiden, ob Sie das Lead freischalten möchten.",
  },
  {
    question: "Welche Arten von Anfragen erhalte ich?",
    answer:
      "Je nach Ihrem Leistungsprofil erhalten Sie Anfragen für Umzug, Endreinigung, Entrümpelung, Klaviertransport, Möbellift, Renovation, Malerarbeiten oder Lagerung — ausschliesslich aus Ihrer Wunschregion.",
  },
  {
    question: "Wie werden Anfragen auf Qualität geprüft?",
    answer:
      "Jede Kundenanfrage wird automatisch auf Vollständigkeit geprüft und manuell stichprobenartig kontrolliert. Gefälschte oder unvollständige Anfragen werden nicht weitergeleitet.",
  },
  {
    question: "Verfallen nicht verwendete Token?",
    answer:
      "Nein. Ihre Token haben kein Ablaufdatum. Sie können Token jederzeit kaufen und nach Bedarf einsetzen — ohne Druck oder Verfallsdatum.",
  },
  {
    question: "Kann ich meine Region und mein Leistungsangebot anpassen?",
    answer:
      "Ja, jederzeit. In Ihren Einstellungen können Sie Ihr Servicegebiet, Ihre angebotenen Dienstleistungen und weitere Profilangaben beliebig anpassen.",
  },
];

const DashFaqSection = () => {
  return (
    <section className="py-20 lg:py-28 bg-white">
      <div className="container-custom">
        <div className="grid lg:grid-cols-5 gap-12 lg:gap-16">
          {/* Left: Header */}
          <div className="lg:col-span-2 lg:sticky lg:top-32 self-start">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
              Häufige Fragen
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Noch Fragen?
            </h2>
            <p className="text-gray-500 leading-relaxed mb-8">
              Hier finden Sie Antworten auf die häufigsten Fragen von Partnerfirmen.
              Bei weiteren Fragen schreiben Sie uns gerne.
            </p>
            <Button variant="outline" size="lg" asChild>
              <Link to="/partner-werden" className="group">
                Jetzt Partner werden
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </div>

          {/* Right: FAQ accordion */}
          <div className="lg:col-span-3">
            <Accordion type="single" collapsible className="space-y-3">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="border border-gray-100 rounded-xl px-6 bg-gray-50/50 hover:bg-gray-50 transition-colors data-[state=open]:bg-primary/3 data-[state=open]:border-primary/20"
                >
                  <AccordionTrigger className="text-left font-semibold text-gray-900 hover:no-underline py-5 text-base">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-gray-500 leading-relaxed pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashFaqSection;
