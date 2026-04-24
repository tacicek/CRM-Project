import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";

const Datenschutz = () => {
  return (
    <>
      <Helmet>
        <title>Datenschutzerklärung | Offerio</title>
        <meta name="description" content="Datenschutzerklärung von Offerio - Erfahren Sie, wie wir Ihre Daten schützen und verarbeiten." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Datenschutzerklärung","item":"https://offerio.ch/datenschutz"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="py-20 lg:py-28">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-8">Datenschutzerklärung</h1>
              
              <div className="prose prose-lg max-w-none space-y-8 text-muted-foreground">
                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">1. Einleitung</h2>
                  <p>
                    Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen. Diese Datenschutzerklärung 
                    informiert Sie über die Erhebung, Verarbeitung und Nutzung Ihrer personenbezogenen Daten bei 
                    der Nutzung unserer Webseite offerio.ch.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">2. Verantwortliche Stelle</h2>
                  <p>
                    Verantwortlich für die Datenverarbeitung auf dieser Webseite ist:
                  </p>
                  <address className="not-italic mt-4 p-4 bg-muted rounded-lg">
                    Offerio<br />
                    Bahnhofstrasse 10<br />
                    8001 Zürich<br />
                    Schweiz<br /><br />
                    E-Mail: info@offerio.ch
                  </address>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">3. Erhebung und Verarbeitung personenbezogener Daten</h2>
                  <p>Wir erheben personenbezogene Daten, wenn Sie:</p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>eine Anfrage über unser Formular stellen</li>
                    <li>sich als Firma registrieren</li>
                    <li>uns per E-Mail oder Telefon kontaktieren</li>
                    <li>unsere Webseite besuchen (technische Daten)</li>
                  </ul>
                  <p className="mt-4">
                    Die erhobenen Daten umfassen je nach Nutzung: Name, E-Mail-Adresse, Telefonnummer, Adresse, 
                    Angaben zu Ihrem Umzugs- oder Reinigungsbedarf sowie technische Daten wie IP-Adresse und Browser-Typ.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">4. Zweck der Datenverarbeitung</h2>
                  <p>Wir verarbeiten Ihre Daten für folgende Zwecke:</p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Vermittlung von Offerten zwischen Kunden und Dienstleistungsunternehmen</li>
                    <li>Kommunikation bezüglich Ihrer Anfragen</li>
                    <li>Bereitstellung und Verbesserung unserer Dienstleistungen</li>
                    <li>Erfüllung rechtlicher Verpflichtungen</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">5. Weitergabe von Daten</h2>
                  <p>
                    Ihre Anfragedaten werden an ausgewählte, verifizierte Partnerunternehmen weitergegeben, 
                    damit diese Ihnen ein Angebot unterbreiten können. Eine Weitergabe an sonstige Dritte 
                    erfolgt nur, soweit dies gesetzlich erlaubt oder erforderlich ist.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">6. Speicherdauer</h2>
                  <p>
                    Wir speichern Ihre personenbezogenen Daten nur so lange, wie es für die Erfüllung der 
                    genannten Zwecke erforderlich ist oder gesetzliche Aufbewahrungsfristen bestehen.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">7. Ihre Rechte</h2>
                  <p>Sie haben das Recht auf:</p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Auskunft über Ihre gespeicherten Daten</li>
                    <li>Berichtigung unrichtiger Daten</li>
                    <li>Löschung Ihrer Daten</li>
                    <li>Einschränkung der Verarbeitung</li>
                    <li>Datenübertragbarkeit</li>
                    <li>Widerspruch gegen die Verarbeitung</li>
                  </ul>
                  <p className="mt-4">
                    Zur Ausübung Ihrer Rechte kontaktieren Sie uns bitte unter info@offerio.ch.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">8. Cookies</h2>
                  <p>
                    Unsere Webseite verwendet Cookies, um die Benutzerfreundlichkeit zu verbessern. 
                    Cookies sind kleine Textdateien, die auf Ihrem Gerät gespeichert werden. Sie können 
                    die Verwendung von Cookies in Ihren Browsereinstellungen deaktivieren.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">9. Datensicherheit</h2>
                  <p>
                    Wir setzen technische und organisatorische Sicherheitsmassnahmen ein, um Ihre Daten 
                    gegen zufällige oder vorsätzliche Manipulation, Verlust, Zerstörung oder den Zugriff 
                    unberechtigter Personen zu schützen. Unsere Sicherheitsmassnahmen werden entsprechend 
                    der technologischen Entwicklung fortlaufend verbessert.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">10. Änderungen</h2>
                  <p>
                    Wir behalten uns vor, diese Datenschutzerklärung jederzeit anzupassen. Die aktuelle 
                    Version ist auf unserer Webseite verfügbar.
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

export default Datenschutz;