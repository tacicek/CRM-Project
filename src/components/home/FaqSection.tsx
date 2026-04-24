import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { faqs } from "@/data/faqs";

const FaqSection = () => {
  // Schema.org markup for FAQs
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };

  return (
    <section className="py-16 bg-white" id="faq">
      <div className="container mx-auto px-4 max-w-3xl">
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
        
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Häufig gestellte Fragen</h2>
          <p className="text-gray-600">Alles was Sie über unseren Service wissen müssen</p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`item-${index}`} className="border-b border-gray-200">
              <AccordionTrigger className="text-left font-medium text-gray-900 hover:text-primary py-4">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-gray-600 leading-relaxed pb-4">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FaqSection;

