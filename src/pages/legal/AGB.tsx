import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";

const AGB = () => {
  return (
    <>
      <Helmet>
        <title>Allgemeine Geschäftsbedingungen | Offerio</title>
        <meta name="description" content="Allgemeine Geschäftsbedingungen (AGB) von Offerio für die Nutzung unserer Plattform." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"AGB","item":"https://offerio.ch/agb"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="py-20 lg:py-28">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>
              
              <div className="prose prose-lg max-w-none space-y-8 text-muted-foreground">
                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">1. Geltungsbereich</h2>
                  <p>
                    Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Dienstleistungen, die über 
                    die Plattform offerio.ch angeboten werden. Mit der Nutzung der Plattform erklären Sie 
                    sich mit diesen AGB einverstanden.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">2. Leistungsbeschreibung</h2>
                  <p>
                    Offerio ist eine Vermittlungsplattform, die Privatpersonen und Unternehmen mit 
                    Dienstleistungsanbietern im Bereich Umzug und Reinigung zusammenbringt. Wir vermitteln 
                    Kontakte und ermöglichen den Vergleich von Offerten.
                  </p>
                  <p className="mt-4">
                    <strong>Für Kunden:</strong> Die Nutzung der Plattform zur Einholung von Offerten ist 
                    kostenlos und unverbindlich.
                  </p>
                  <p className="mt-4">
                    <strong>Für Partnerunternehmen:</strong> Die Registrierung ist kostenlos. Für die 
                    Annahme von Leads wird ein Token-basiertes System verwendet.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">3. Registrierung und Nutzerkonto</h2>
                  <p>
                    Für bestimmte Funktionen ist eine Registrierung erforderlich. Sie sind verpflichtet, 
                    wahrheitsgemässe Angaben zu machen und Ihre Zugangsdaten vertraulich zu behandeln. 
                    Bei Missbrauch behalten wir uns das Recht vor, Konten zu sperren.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">4. Token-System für Partnerunternehmen</h2>
                  <p>
                    Partnerunternehmen erwerben Tokens, um Leads anzunehmen. Die Token-Kosten variieren 
                    je nach Art und Umfang der Anfrage. Gekaufte Tokens sind nicht rückerstattbar, 
                    sofern nicht anders vereinbart.
                  </p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Tokens werden bei Annahme eines Leads abgebucht</li>
                    <li>Die Token-Preise werden transparent vor dem Kauf angezeigt</li>
                    <li>Nicht genutzte Tokens verfallen nicht</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">5. Pflichten der Nutzer</h2>
                  <p>Nutzer verpflichten sich:</p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Keine falschen oder irreführenden Angaben zu machen</li>
                    <li>Die Plattform nicht für rechtswidrige Zwecke zu nutzen</li>
                    <li>Keine automatisierten Systeme zur Nutzung der Plattform einzusetzen</li>
                    <li>Die Rechte Dritter zu respektieren</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">6. Haftungsausschluss</h2>
                  <p>
                    Offerio fungiert ausschliesslich als Vermittler. Wir übernehmen keine Haftung für:
                  </p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Die Qualität der von Partnerunternehmen erbrachten Dienstleistungen</li>
                    <li>Die Richtigkeit der von Nutzern oder Partnern gemachten Angaben</li>
                    <li>Schäden, die aus Verträgen zwischen Kunden und Partnerunternehmen entstehen</li>
                    <li>Technische Störungen oder Ausfälle der Plattform</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">7. Geistiges Eigentum</h2>
                  <p>
                    Alle Inhalte der Plattform, einschliesslich Texte, Grafiken, Logos und Software, 
                    sind urheberrechtlich geschützt. Eine Vervielfältigung oder Verwendung ohne 
                    ausdrückliche Genehmigung ist untersagt.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">8. Kündigung</h2>
                  <p>
                    Nutzer können ihr Konto jederzeit kündigen. Offerio behält sich das Recht vor, 
                    Konten bei Verstoss gegen diese AGB zu sperren oder zu löschen.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">9. Änderungen der AGB</h2>
                  <p>
                    Wir behalten uns vor, diese AGB jederzeit zu ändern. Änderungen werden auf der 
                    Webseite veröffentlicht. Die fortgesetzte Nutzung der Plattform gilt als 
                    Zustimmung zu den geänderten AGB.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">10. Anwendbares Recht und Gerichtsstand</h2>
                  <p>
                    Es gilt schweizerisches Recht. Ausschliesslicher Gerichtsstand ist Zürich, Schweiz.
                  </p>
                  <p className="mt-4 text-sm">
                    Stand: Dezember 2024
                  </p>
                </section>
              </div>
            </div>
          </div>
        </div>
      </Layout>
    </>
  );
};

export default AGB;