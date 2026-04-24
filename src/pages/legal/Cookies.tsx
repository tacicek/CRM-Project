import { Helmet } from "react-helmet-async";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { openCookieSettings } from "@/components/CookieBanner";

const Cookies = () => {
  return (
    <>
      <Helmet>
        <title>Cookie-Richtlinie | Offerio</title>
        <meta name="description" content="Cookie-Richtlinie von Offerio - Erfahren Sie, welche Cookies wir verwenden und wie Sie Ihre Einstellungen verwalten können." />
        <script type="application/ld+json">{`{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Startseite","item":"https://offerio.ch"},{"@type":"ListItem","position":2,"name":"Cookie-Richtlinie","item":"https://offerio.ch/cookies"}]}`}</script>
      </Helmet>
      <Layout>
        <div className="py-20 lg:py-28">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-3xl md:text-4xl font-bold mb-8">Cookie-Richtlinie</h1>
              
              <div className="prose prose-lg max-w-none space-y-8 text-muted-foreground">
                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Was sind Cookies?</h2>
                  <p>
                    Cookies sind kleine Textdateien, die von Webseiten auf Ihrem Gerät (Computer, Tablet, Smartphone) 
                    gespeichert werden. Sie helfen dabei, Ihre Präferenzen zu speichern, die Benutzerfreundlichkeit 
                    zu verbessern und uns zu verstehen, wie Besucher unsere Webseite nutzen.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Welche Cookies verwenden wir?</h2>
                  
                  <div className="space-y-6 mt-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">🔒 Notwendige Cookies</h3>
                      <p className="text-sm">
                        Diese Cookies sind für die Grundfunktionen der Webseite erforderlich. Sie ermöglichen 
                        grundlegende Funktionen wie Seitennavigation und Zugang zu gesicherten Bereichen. 
                        Die Webseite kann ohne diese Cookies nicht ordnungsgemäss funktionieren.
                      </p>
                      <div className="mt-3 text-xs">
                        <strong>Beispiele:</strong> Session-Cookies, Cookie-Einwilligungs-Cookie, Authentifizierungs-Cookies
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">📊 Statistik-Cookies</h3>
                      <p className="text-sm">
                        Diese Cookies helfen uns zu verstehen, wie Besucher mit der Webseite interagieren, 
                        indem sie Informationen anonym sammeln und melden. Dies hilft uns, unsere Webseite 
                        und Dienstleistungen kontinuierlich zu verbessern.
                      </p>
                      <div className="mt-3 text-xs">
                        <strong>Beispiele:</strong> Google Analytics (_ga, _gid), Seitenaufrufe, Verweildauer
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">🎯 Marketing-Cookies</h3>
                      <p className="text-sm">
                        Diese Cookies werden verwendet, um Werbung relevanter für Sie und Ihre Interessen 
                        zu gestalten. Sie werden auch dazu verwendet, die Wirksamkeit von Werbekampagnen 
                        zu messen und die Anzahl der Anzeigeneinblendungen zu begrenzen.
                      </p>
                      <div className="mt-3 text-xs">
                        <strong>Beispiele:</strong> Facebook Pixel, Google Ads, LinkedIn Insight Tag, TikTok Pixel
                      </div>
                    </div>

                    <div className="p-4 bg-muted rounded-lg">
                      <h3 className="font-semibold text-foreground mb-2">⚙️ Präferenz-Cookies</h3>
                      <p className="text-sm">
                        Diese Cookies ermöglichen es der Webseite, Informationen zu speichern, die das 
                        Verhalten oder Aussehen der Webseite ändern, wie z.B. Ihre bevorzugte Sprache 
                        oder die Region, in der Sie sich befinden.
                      </p>
                      <div className="mt-3 text-xs">
                        <strong>Beispiele:</strong> Spracheinstellungen, Theme-Präferenzen
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Detaillierte Cookie-Liste</h2>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm border rounded-lg overflow-hidden">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Cookie</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Anbieter</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Zweck</th>
                          <th className="px-4 py-3 text-left font-semibold text-foreground">Laufzeit</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr>
                          <td className="px-4 py-3">offerio_cookie_consent</td>
                          <td className="px-4 py-3">Offerio</td>
                          <td className="px-4 py-3">Speichert Ihre Cookie-Einwilligung</td>
                          <td className="px-4 py-3">1 Jahr</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3">offerio_visitor_id</td>
                          <td className="px-4 py-3">Offerio</td>
                          <td className="px-4 py-3">Anonyme Besucher-Identifizierung</td>
                          <td className="px-4 py-3">2 Jahre</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3">_ga, _gid</td>
                          <td className="px-4 py-3">Google Analytics</td>
                          <td className="px-4 py-3">Webseitenanalyse</td>
                          <td className="px-4 py-3">2 Jahre / 24 Stunden</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3">_fbp</td>
                          <td className="px-4 py-3">Facebook</td>
                          <td className="px-4 py-3">Werbung und Remarketing</td>
                          <td className="px-4 py-3">3 Monate</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3">li_sugr</td>
                          <td className="px-4 py-3">LinkedIn</td>
                          <td className="px-4 py-3">B2B-Marketing</td>
                          <td className="px-4 py-3">3 Monate</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Wie können Sie Cookies verwalten?</h2>
                  <p>
                    Sie haben jederzeit die Möglichkeit, Ihre Cookie-Einstellungen anzupassen. Klicken Sie 
                    auf den Button unten, um Ihre Präferenzen zu ändern:
                  </p>
                  <div className="mt-6">
                    <Button onClick={openCookieSettings} size="lg">
                      Cookie-Einstellungen verwalten
                    </Button>
                  </div>
                  <p className="mt-4">
                    Alternativ können Sie Cookies auch in Ihrem Browser verwalten. Die meisten Browser 
                    ermöglichen es Ihnen:
                  </p>
                  <ul className="list-disc pl-6 mt-4 space-y-2">
                    <li>Alle Cookies anzuzeigen und zu löschen</li>
                    <li>Cookies von bestimmten Webseiten zu blockieren</li>
                    <li>Alle Cookies zu blockieren</li>
                    <li>Alle Cookies beim Schliessen des Browsers zu löschen</li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Browser-spezifische Anleitungen</h2>
                  <ul className="list-disc pl-6 space-y-2">
                    <li>
                      <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Google Chrome
                      </a>
                    </li>
                    <li>
                      <a href="https://support.mozilla.org/de/kb/cookies-erlauben-und-ablehnen" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Mozilla Firefox
                      </a>
                    </li>
                    <li>
                      <a href="https://support.apple.com/de-ch/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Safari
                      </a>
                    </li>
                    <li>
                      <a href="https://support.microsoft.com/de-de/microsoft-edge/cookies-in-microsoft-edge-löschen-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Microsoft Edge
                      </a>
                    </li>
                  </ul>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Auswirkungen der Cookie-Deaktivierung</h2>
                  <p>
                    Wenn Sie alle Cookies blockieren, kann dies die Funktionalität unserer Webseite 
                    beeinträchtigen. Einige Funktionen wie das Speichern Ihrer Anmeldedaten oder 
                    Ihre Sprachpräferenzen funktionieren möglicherweise nicht mehr ordnungsgemäss.
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Rechtsgrundlage</h2>
                  <p>
                    Die Verwendung von notwendigen Cookies basiert auf unserem berechtigten Interesse, 
                    eine funktionsfähige Webseite bereitzustellen (Art. 6 Abs. 1 lit. f DSGVO, Art. 31 
                    Abs. 1 nDSG). Für alle anderen Cookie-Kategorien holen wir Ihre ausdrückliche 
                    Einwilligung ein (Art. 6 Abs. 1 lit. a DSGVO, Art. 31 Abs. 1 nDSG).
                  </p>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Kontakt</h2>
                  <p>
                    Bei Fragen zu unserer Cookie-Richtlinie können Sie uns jederzeit kontaktieren:
                  </p>
                  <address className="not-italic mt-4 p-4 bg-muted rounded-lg">
                    Offerio<br />
                    E-Mail: <a href="mailto:info@offerio.ch" className="text-primary hover:underline">info@offerio.ch</a>
                  </address>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground mb-4">Änderungen</h2>
                  <p>
                    Wir behalten uns vor, diese Cookie-Richtlinie jederzeit anzupassen. Die aktuelle 
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

export default Cookies;

