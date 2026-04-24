import { Link } from "react-router-dom";
import { cities } from "@/data/cities";

const CityLinks = () => {
  return (
    <section className="py-12 bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-8 text-gray-900">Wir sind in der ganzen Schweiz für Sie da</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {cities.map((regionData) => (
            <div key={regionData.region} className="space-y-3">
              <h3 className="font-semibold text-gray-900 text-sm">{regionData.region}</h3>
              <ul className="space-y-2">
                {regionData.cities.map((city) => (
                  <li key={city.slug}>
                    <Link 
                      to={`/umzug-${city.slug}`}
                      className="text-sm text-gray-600 hover:text-primary hover:underline block"
                    >
                      Umzug {city.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CityLinks;

