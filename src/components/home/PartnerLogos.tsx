const PartnerLogos = () => {
  return (
    <section className="py-12 bg-gray-50 border-y border-gray-100">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-medium text-gray-500 uppercase tracking-wider mb-8">
          Bekannt aus & unsere Partner
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-60 grayscale hover:grayscale-0 transition-all duration-500">
          {/* Using text placeholders as specified images might not exist, but structure allows imgs */}
          <div className="text-xl font-bold font-serif text-gray-800">20minuten</div>
          <div className="text-xl font-bold font-sans text-red-600">Blick</div>
          <div className="text-xl font-bold font-serif text-gray-900">NZZ</div>
          <div className="text-xl font-bold font-mono text-blue-800">Handelszeitung</div>
          <div className="text-xl font-bold text-yellow-600">local.ch</div>
        </div>
        
        <div className="flex justify-center gap-6 mt-10">
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm font-medium text-gray-700">
            <span className="text-red-500">🇨🇭</span> Swiss Made
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm font-medium text-gray-700">
            🔒 SSL Verschlüsselt
          </span>
          <span className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm text-sm font-medium text-gray-700">
            🛡️ DSGVO Konform
          </span>
        </div>
      </div>
    </section>
  );
};

export default PartnerLogos;

