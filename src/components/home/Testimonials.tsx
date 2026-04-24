import { Star, MapPin, TrendingUp } from "lucide-react";
import { testimonials } from "@/data/testimonials";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const Testimonials = () => {
  return (
    <section className="py-16 bg-white overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Das sagen unsere Kunden</h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Echte Bewertungen von Nutzern, die ihren Umzug oder ihre Reinigung erfolgreich über Offerio.ch abgewickelt haben.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {testimonials.map((testimonial) => (
            <Card key={testimonial.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center gap-4 pb-2">
                <Avatar className="bg-primary/10">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {testimonial.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-gray-900">{testimonial.name}</p>
                  <div className="flex items-center text-xs text-gray-500 gap-1">
                    <MapPin className="w-3 h-3" />
                    {testimonial.location} • {testimonial.service}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex mb-3">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < testimonial.rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                    />
                  ))}
                </div>
                <p className="text-gray-600 text-sm leading-relaxed italic">
                  "{testimonial.text}"
                </p>
                {testimonial.outcome && (
                  <div className="mt-3 flex items-center gap-2 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded-full w-fit">
                    <TrendingUp className="w-3.5 h-3.5" />
                    {testimonial.outcome}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-4 text-right">{testimonial.date}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Aggregate Trust Bar */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-4 bg-gray-50 px-6 py-3 rounded-full border border-gray-200">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-bold">4.8 / 5</span> aus <span className="font-bold">2'847</span> Bewertungen
            </div>
          </div>
        </div>

        {/* TODO: Replace with real customer data – currently placeholder testimonials */}
      </div>
    </section>
  );
};

export default Testimonials;
