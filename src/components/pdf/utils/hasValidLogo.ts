/**
 * Traegt dieses Feld eine Quelle, die `<Image>` tatsaechlich laden kann?
 *
 * `companies.logo` haelt entweder eine Data-URI oder eine URL — oder Reste: leeren String,
 * einen Dateinamen ohne Schema, ein "null" aus einem alten Import. Ein `<Image>` mit so
 * einer Quelle rendert nichts und meldet nichts; im Beleg entsteht eine Luecke.
 *
 * Wichtig fuer die Vorlagen, die den Firmennamen NUR als Rueckfall zeigen (der Name steht
 * ja bereits im Logo): faellt die Pruefung zu grosszuegig aus, nennt der Kopf die Firma
 * ueberhaupt nicht mehr. Deshalb eine Regel an einer Stelle statt drei Kopien.
 */
export const hasValidLogo = (logo?: string | null): boolean =>
  !!logo &&
  (logo.startsWith("data:image") ||
    logo.startsWith("http://") ||
    logo.startsWith("https://"));
