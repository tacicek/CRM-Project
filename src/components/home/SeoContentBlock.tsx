import { Link } from "react-router-dom";

const SeoContentBlock = () => {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          
          {/* Block 1: Umzug */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Umzugsfirma finden leicht gemacht</h3>
            <p className="text-gray-600 leading-relaxed">
              Ein <strong>Umzug in der Schweiz</strong> erfordert sorgfältige 
              Planung und professionelle Unterstützung. Ob Sie von Zürich nach 
              Bern, innerhalb von Basel oder in einen anderen Kanton ziehen – 
              mit offerio.ch finden Sie schnell die passende 
              <Link to="/anfrage/umzug" className="text-primary underline underline-offset-2 hover:text-primary/80 ml-1">Umzugsfirma</Link> für Ihre Bedürfnisse.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-gray-900">Was kostet ein Umzug in der Schweiz?</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
                <li>1-2 Zimmer Wohnung: ab CHF 490.-</li>
                <li>3-4 Zimmer Wohnung: ab CHF 890.-</li>
                <li>5+ Zimmer / Haus: ab CHF 1'490.-</li>
                <li>Firmenumzug: Auf Anfrage</li>
              </ul>
            </div>
          </div>

          {/* Block 2: Reinigung */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Professionelle Reinigung mit Abnahmegarantie</h3>
            <p className="text-gray-600 leading-relaxed">
              Die <strong>Endreinigung</strong> – auch Umzugsreinigung oder 
              Abgabereinigung genannt – ist in der Schweiz beim Auszug aus 
              einer Mietwohnung obligatorisch. Mit einer professionellen 
              <Link to="/anfrage/reinigung" className="text-primary underline underline-offset-2 hover:text-primary/80 ml-1">Reinigungsfirma</Link> stellen Sie sicher, 
              dass die Wohnungsabnahme reibungslos verläuft.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-gray-900">Reinigungspreise (Richtwerte)</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
                <li>1-2 Zimmer: CHF 450 - 650</li>
                <li>3-4 Zimmer: CHF 650 - 950</li>
                <li>5+ Zimmer: CHF 950 - 1'400</li>
                <li>Grundreinigung: ab CHF 35.-/h</li>
              </ul>
            </div>
          </div>

          {/* Block 3: Räumung */}
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-gray-900">Entrümpelung und Haushaltsauflösung</h3>
            <p className="text-gray-600 leading-relaxed">
              Eine <strong>Räumung oder Entrümpelung</strong> wird oft bei 
              Haushaltsauflösungen, Nachlassregelungen oder Messie-Wohnungen 
              benötigt. Unsere Partner übernehmen die komplette 
              <Link to="/anfrage/raeumung" className="text-primary underline underline-offset-2 hover:text-primary/80 ml-1">Wohnungsräumung</Link> inkl. fachgerechter 
              Entsorgung und Recycling.
            </p>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-semibold text-sm mb-2 text-gray-900">Räumungskosten (Richtwerte)</h4>
              <ul className="text-sm text-gray-600 space-y-1 list-disc pl-4">
                <li>Kellerräumung: CHF 500 - 1'000</li>
                <li>2-Zimmer Wohnung: CHF 800 - 2'000</li>
                <li>4-Zimmer Wohnung: CHF 1'500 - 3'000</li>
                <li>Einfamilienhaus: CHF 2'500 - 5'000</li>
              </ul>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};

export default SeoContentBlock;

