import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Loader2, 
  Save, 
  Trash2, 
  Plus, 
  GripVertical, 
  ChevronDown,
  FileText,
  Wand2,
  Eye,
  Copy
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/i18n/useI18n";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

interface AgbSection {
  id?: string;
  company_id: string;
  service_type: string;
  title: string;
  content: string;
  display_order: number;
  is_active: boolean;
}

interface AgbSectionEditorProps {
  companyId: string;
  serviceType: string;
  serviceLabel: string;
  allServiceTypes?: { type: string; label: string }[];
}

// Default AGB templates for different services.
//
// These are DB CONTENT, not UI chrome: the seeded title/content end up in `agb_sections`
// and are read by the CUSTOMER on the offer PDF. They must NOT be routed through `useT()`
// (that would render them in the OPERATOR's language). German stays the base column; the
// customer-facing translation lives in the `translations` JSONB column and is edited with
// the ContentTranslationDialog.

// ASTAG Standard-Umzugsbedingungen (Fachgruppe Möbeltransporte des Schweizerischen
// Nutzfahrzeugverbandes ASTAG, Stand 01.01.2006). Offizielle Branchenvorlage — wird
// für service_type "umzug" als Default geladen. Wortlaut unverändert übernommen.
const astagUmzugTemplates: Omit<AgbSection, 'id' | 'company_id' | 'service_type'>[] = [
  {
    title: "Allgemeine Umzugsbedingungen der Fachgruppe Möbeltransporte des Schweizerischen Nutzfahrzeugverbandes ASTAG",
    content: `Stand: 01.01.2006 · © ASTAG`,
    display_order: 0,
    is_active: true,
  },
  {
    title: "Art. 1 Geltungsbereich",
    content: `Die Ausführung eines Auftrages erfolgt zu den nachstehenden Bedingungen der Fachgruppe Möbeltransporte des Schweizerischen Nutzfahrzeugverbandes ASTAG soweit ihnen nicht zwingende gesetzliche Vorschriften entgegenstehen. Grundlage der Bedingungen bilden die Bestimmungen des Schweizerischen Obligationenrechts (OR) sowie das Abkommen zwischen der Schweizerischen Eidgenossenschaft und der Europäischen Gemeinschaft über den Güter- und Personenverkehr auf Schiene und Strasse (AS 2002, 1649). Die Allgemeinen Bedingungen dienen dazu, die gesetzlichen Bestimmungen zu ergänzen. Von den Bedingungen abweichende Vereinbarungen sind schriftlich zu treffen.`,
    display_order: 1,
    is_active: true,
  },
  {
    title: "Art. 2 Allgemeines",
    content: `Der Auftrag hat alle für eine ordentliche Ausführung notwendigen Angaben, wie Hinweise auf reglementierte Güter (z.B. Gefahrengut) sowie solche, die einer besonderen Behandlung bedürfen, zu enthalten.

Der Frachtführer überprüft den ihm erteilten Auftrag sorgfältig; er ist jedoch nicht verpflichtet, den Inhalt von Transportgefässen oder Sendungen zu überprüfen, noch Gewichts- oder Masskontrollen vorzunehmen. Stellt der Frachtführer Unklarheiten fest, so klärt er sie raschmöglichst mit dem Auftraggeber ab. Der über das mit dem Auftraggeber vereinbarte Volumen hinausgehende Laderaum bleibt zur Verfügung des Frachtführers. Dieser ist berechtigt, die Ausführung des übernommenen Auftrages einem anderen Frachtführer zu übertragen.`,
    display_order: 2,
    is_active: true,
  },
  {
    title: "Art. 3 Transportübernahme im Allgemeinen",
    content: `Jeder Auftrag setzt voraus, dass er unter normalen Verhältnissen durchgeführt werden kann; Die Hauptverkehrsstrassen sowie die Strassen und Wege zu den Häusern, wo Belad und Entlad stattfinden, müssen für die Transportfahrzeuge befahrbar sein.

Bei Vorgärten und dergleichen gelten als normale Zufahrtsverhältnisse höchstens 15 Meter Distanz zwischen Fahrzeug und Hauseingang. Korridore, Treppen usw. sollen einen reibungslosen Transport ermöglichen. Ferner wird vorausgesetzt, dass die behördlichen Bestimmungen die Ausführung in der vorgesehenen Weise zulassen.

In allen anderen Fällen erhöht sich der Umzugspreis nach Massgabe der Mehraufwendungen.`,
    display_order: 3,
    is_active: true,
  },
  {
    title: "Art. 4 Pflichten des Frachtführers",
    content: `Der Frachtführer ist dazu verpflichtet, die für die Ausführung des Auftrages notwendigen Transportmittel auf den vereinbarten Zeitpunkt bereitzustellen. Der Frachtführer führt den Auftrag vertragsgemäss und mit der notwendigen Sorgfalt aus. Die Ablieferung des Frachtgutes am Bestimmungsort hat sofort nach Ankunft des Transportes oder nach Vereinbarung zu erfolgen.`,
    display_order: 4,
    is_active: true,
  },
  {
    title: "Art. 5 Pflichten des Auftraggebers",
    content: `Der Auftraggeber hat für geeignete Verpackung zu sorgen. Er hat dem Frachtführer rechtzeitig die Adresse des Empfängers, den Ort der Ablieferung und die örtlichen Verhältnisse genau zu bezeichnen.

Der Auftraggeber ist verpflichtet, den Frachtführer auf die besondere Beschaffenheit des Transportgutes und dessen Schadenanfälligkeit aufmerksam zu machen. Der Auftraggeber hat dafür zu sorgen, dass die Transportarbeiten, die Ver- und Entladung im vereinbarten Zeitpunkt bzw. sofort nach Eintreffen der Transportfahrzeuge begonnen werden können.

Vorbehältlich anderer Vereinbarung obliegt die Besorgung aller für die Durchführung des Transportes erforderlichen Dokumente, Bewilligungen und Absperrungen dem Auftraggeber. Der Auftraggeber ist zur wahrheitsgetreuen Deklaration des Transportgutes verpflichtet und übernimmt gegenüber dem Frachtführer sowie den Bahn- und Zollorganen oder weiteren Behörden die volle Verantwortung. Ohne diesbezügliche Weisung durch den Auftraggeber ist der Frachtführer berechtigt, das Transportgut als Übersiedlungsgut zu behandeln.

Der Auftraggeber hat für die Beschaffung der erforderlichen Zolldokumente besorgt zu sein und ist für deren Richtigkeit verantwortlich. Für alle Folgen, die durch das Fehlen, die verspätete Zustellung und die Unvollständigkeit oder Unrichtigkeit dieser Dokumente entstehen, hat der Auftraggeber aufzukommen. Er haftet dem Frachtführer für alle sich aus der Zollbehandlung des Transportgutes ergebenden Auslagen. Der Preis für die Zollabfertigungskosten setzt eine normale Abwicklung voraus. Verlängerte Zollaufenthalte und besondere Verhandlungen mit den zuständigen Behörden sind dem Frachtführer entsprechend zu vergüten. Der Frachtführer ist nicht verpflichtet, Frachten, Zölle und Abgaben zu bevorschussen. Er kann vom Auftraggeber Vorschüsse in der jeweiligen Währung verlangen. Tritt der Frachtführer in Vorlage, so sind ihm Vorlageprovision und Zins sowie ein angemessener Kursverlust zu ersetzen. Für alle Umtriebe und Mehrkosten, die infolge verspäteter Abnahme des Transportgutes durch den Auftraggeber entstehen, hat dieser aufzukommen. Kann innerhalb einer Wartezeit von vier Stunden die Entladung nicht begonnen werden, ist der Frachtführer berechtigt, auf Rechnung und Gefahr des Auftraggebers das Transportgut einzulagern. Dabei beschränkt sich seine Haftung auf die sorgfältige Auswahl des Einlagerungsortes. Ausdrücklich vom Transport ausgeschlossen sind Bargeld, Inhaberpapiere, inklusive Effekten im Sinne des Börsengesetzes, die Inhabereigenschaften haben, oder Edelmetalle.`,
    display_order: 5,
    is_active: true,
  },
  {
    title: "Art. 6 Preise",
    content: `Der Preis berechnet sich nach Aufwand oder pauschal. Im Preis nicht eingeschlossen sind dagegen, besondere Vereinbarungen vorbehalten, folgende Aufwendungen:
a) das Ein- und Auspacken des Umzugsgutes, insbesondere für Verpackungsarbeiten, die am Umzugstag durch den Frachtführer vorgenommen werden müssen.
b) spezieller Hin- oder Rücktransport von Packmaterial sowie dessen Miete oder Kauf;
c) das Demontieren und Montieren von komplizierten oder neuen Möbeln, die besonderen Zeitaufwand oder den Beizug eines Spezialisten benötigen;
d) der Transport von Kühlschränken/Truhen von über 200 l, Klavieren, Flügeln, Kassenschränken und anderen Gegenständen vom mehr als 100 kg Eigengewicht;
e) das Abnehmen und Anbringen von Bildern, Spiegeln, Uhren, Lampen, Vorhängen, Einbauten usw.;
f) der Mehraufwand für Gegenstände, deren Transport durch Fenster oder über Balkone zu erfolgen hat;
g) die Prämien von Transportversicherungen;
h) Zollabfertigung, Zoll und Zollspesen;
i) Strassensteuern und Fährkosten sowie amtliche Gebühren aller Art;
j) Mehraufwendungen bzw. Mehrleistungen im Interesse des Umzuges auch ohne besonderen Auftrag;
k) Mehraufwendungen durch Witterungsverhältnisse oder falls in gesperrten oder aufgerissenen Strassen das Transportfahrzeug nicht vor das Haus gefahren werden kann, desgleichen für Wartezeiten des Transportfahrzeuges und des Personals, das der Frachtführer nicht verschuldet hat;
l) ferner angemessene Zuschläge für das Tragen der Güter auf weiten oder ungewöhnlichen Wegen, soweit nicht bei der Preisvereinbarung eine ausdrückliche Berücksichtigung dieser Umstände stattgefunden hat sowie Mehrkosten, die durch Umwege entstehen, falls die direkten Wege gesperrt oder nicht benutzbar sind;

Das Abnehmen und Anbringen von Beleuchtungskörpern und anderen an das Stromnetz angeschlossenen Apparaten darf zufolge gesetzlicher Bestimmungen nicht durch das Transportpersonal vorgenommen werden.`,
    display_order: 6,
    is_active: true,
  },
  {
    title: "Art. 7 Bezahlung",
    content: `Umzüge sind grundsätzlich bar zu bezahlen. Der Transportpreis ist vor dem Auslad fällig. Bei Transporten ins Ausland ist Vorauszahlung zu leisten.`,
    display_order: 7,
    is_active: true,
  },
  {
    title: "Art. 8 Umdisponierung / Rücktritt des Auftraggebers",
    content: `Der Auftraggeber hat das Recht, einen in Ausführung begriffenen Transport umzudisponieren, gegen vollständige Abgeltung des dadurch dem Frachtführer entstehenden Schadens.

Ein allfälliger Rücktritt des Auftraggebers hat schriftlich zu erfolgen. Bei Rücktritt innerhalb von 14 Kalendertagen vor dem geplanten Umzug sind 30 % des in der Offerte gestellten Betrages im Sinne einer pauschalierten Abgeltung für Aufwendungen, Bemühungen und Umtriebe geschuldet.

Bei Rücktritt des Auftraggebers innerhalb von 48 Stunden vor dem geplanten Umzug sind 80 % des in der Offerte gestellten Betrages geschuldet. Beweist der Frachtführer einen grösseren Schaden ist auch dieser zu entschädigen.`,
    display_order: 8,
    is_active: true,
  },
  {
    title: "Art. 9 Retentionsrecht",
    content: `Wenn das Frachtgut nicht angenommen oder die Zahlung der auf demselben haftenden Forderungen nicht geleistet wird, kann der Frachtführer das Frachtgut bis zum Wert des geschuldeten Betrages retinieren oder auf Kosten des Auftraggebers hinterlegen. Es gelten insbesondere die Bestimmungen von Art. 444, 445 und 451 OR.

In diesem Fall kann der Frachtführer den Auftraggeber schriftlich auffordern, die Forderung innerhalb von 30 Tagen zu begleichen. Diese Aufforderung hat die Androhung zu enthalten, dass der Frachtführer das Recht hat, bei Unterlassung der Zahlung, die betreffenden Güter ohne weitere Formalitäten freihändig bestens zu verwerten (nach eigenem Ermessen freihändiger Verkauf oder, falls die Güter keinen materiellen Wert aufweisen, Entsorgung).`,
    display_order: 9,
    is_active: true,
  },
  {
    title: "Art. 10 Haftung",
    content: `Der Frachtführer haftet nur für Schäden, die nachweisbar durch grobe Fahrlässigkeit seines Personals verursacht worden sind. Er haftet nur, soweit er nicht nachweist, dass er alle nach den Umständen gebotene Sorgfalt angewendet hat, um einen Schaden dieser Art zu verhüten oder dass der Schaden auch bei Anwendung dieser Sorgfalt eingetreten wäre. Seine Haftung reicht in keinem Falle weiter als diejenige der am Transport beteiligten Transportanstalten (Eisenbahn, Schifffahrts- oder Luftverkehrsgesellschaft, Post usw.).

Der Frachtführer haftet nur für Transportgut, dessen Verpackung den normalen Transportanforderungen entspricht. So bedürfen zerbrechliche Gegenstände, Lampen, Lampenschirme, Pflanzen, technische Geräte (Fernseher, Computer usw.) einer geeigneten Verpackung (Art. 442 OR). Bei Beschädigungen des Inhalts von Kisten und anderen Behältnissen haftet der Frachtführer nur, wenn deren Ein- und Auspacken durch seine eigenen oder von ihm beauftragten Hilfspersonen besorgt worden sind. Die Haftung des Frachtführers beschränkt sich in jedem Fall auf die Kosten einer allfälligen möglichen Reparatur oder einer Entschädigung für Wertminderung, unter Ausschluss jeglicher Ersatzleistung.

Die Haftung des Frachtführers beginnt mit der Übernahme des Transportgutes und endigt in der Regel mit dessen Ablieferung am Bestimmungsort des Auftraggebers, der Einlagerung in einem Lagerhaus oder der Übergabe der Ladung an einen anderen Frachtführer. Soweit der Frachtführer den Auftrag hat, die Güter einer anderen Transportanstalt zu übergeben, erlischt seine Haftung mit Übergabe der Güter. Die Haftung des Frachtführers bei Beschädigung oder Verlust ist limitiert auf den allgemein üblichen Handelswert der Ware zur Zeit der Beschädigung oder des Verlustes und beträgt höchstens CHF 500.– je m3 des beschädigten bzw. verloren gegangenen Gutes. Teile eines Kubikmeters werden proportional angerechnet.

Pro Ereignis ist die Haftung des Frachtführers auf CHF 25'000.– beschränkt. Vorbehalten bleiben besonders vereinbarte Versicherungsabsprachen (Art. 12 nachfolgend).`,
    display_order: 10,
    is_active: true,
  },
  {
    title: "Art. 11 Haftungsausschluss",
    content: `Der Frachtführer ist von seiner Haftung befreit, wenn Verlust oder Beschädigung durch ein Verschulden des Auftraggebers, eine von ihm ohne Zutun des Frachtführers erteilte Weisung, eigene Mängel des Umzugsgutes oder durch Umstände verursacht wurde, auf welche der Unternehmer keinen Einfluss hat. Bei Bruch oder Beschädigung besonders gefährdeter Sachen wie Marmor, Glas- und Porzellanplatten, Stuckrahmen, Leuchter, Lampenschirme, Radio- und Fernsehgeräte, Computer-Hard- und Software sowie Datenverluste und anderen Gegenständen von grosser Empfindlichkeit (Pflanzen, Tiere etc.), ist der Frachtführer von der Haftung befreit, vorausgesetzt, dass er die üblichen Vorsichtsmassnahmen angewandt hat. Bargeld und Werttitel sind von der Haftung ausgeschlossen (Art. 5 Abs. 7 oben). Für Kostbarkeiten wie Schmuck, Dokumente, Kunstgegenstände, Antiquitäten, Sammlerobjekte übernimmt der Frachtführer keine Haftung. Wird dem Frachtführer ein Verzeichnis solcher Gegenstände mit detaillierter Wertangabe übergeben und anhand dieser Unterlagen eine Transportversicherung abgeschlossen, so geniesst der Auftraggeber diesen Versicherungsschutz. Der Frachtführer haftet nicht für Beschädigungen der Güter während des Be- und Entladens, Ab- und Aufseilens, wenn ihre Grösse oder Schwere den Raumverhältnissen an der Be- oder Entladestelle nicht entspricht, der Frachtführer den Auftraggeber oder Empfänger vorher darauf hingewiesen, der Auftraggeber aber auf Durchführung der Leistung bestanden hat oder für Beschädigungen an Wänden, Fenstern, Böden oder Stiegengeländer, wenn die Grösse oder Schwere der zu transportierenden Güter dem Raumverhältnis nicht entsprechen. Der Frachtführer haftet nicht für Schäden am Frachtgut, die durch Feuer, Unfälle, Kriege, Streiks, höhere Gewalt oder einen dem Transportmittel durch Dritte verursachten Schaden entstehen. Wird die Beladung oder Ablieferung wegen Panne, Unfall, Witterungseinflüssen oder aus anderen Gründen, für welche den Frachtführer keine Schuld trifft, verzögert, hat der Auftraggeber keinerlei Anspruch auf irgendwelche Entschädigung. Ohne gegenseitige Vereinbarung ist der Frachtführer für Verzögerungen, die durch nicht rechtzeitige Bereitstellung von Transportmitteln oder durch Nichteinhaltung der reglementarischen Fristen durch andere am Transport beteiligte Transportanstalten entstehen, nicht haftbar. Die dadurch entstandenen Kosten (Standgelder, Zwischenlagerungen usw.) gehen zulasten des Auftraggebers. Auch haftet der Frachtführer nicht für Schäden und Verluste, die aus solchen Umständen entstehen können.`,
    display_order: 11,
    is_active: true,
  },
  {
    title: "Art. 12 Transportversicherung",
    content: `Zur Deckung der Transportrisiken lässt der Frachtführer den Auftraggeber auf dessen ausdrückliche Weisung und gegen Bezahlung der Mehrkosten an einer entsprechenden Versicherung teilhaben. Eine Versicherung des Bruchrisikos setzt voraus, dass die betreffenden Gegenstände vom Frachtführer oder seinen Beauftragten ein- und ausgepackt werden. Die Versicherungssummen sind durch den Auftraggeber festzusetzen. Die Versicherung gilt in jedem Fall zu den üblichen Klauseln der in der Schweiz jeweils angewandten „Allgemeinen Bedingungen für die Versicherung von Gütertransporten" (ABVT) für gebrauchtes Umzugsgut. Lässt der Auftraggeber keine Versicherung abschliessen, so trägt er selbst alle Risiken, für die der Frachtführer nach dem Wortlaut dieser Bedingungen nicht haftet.`,
    display_order: 12,
    is_active: true,
  },
  {
    title: "Art. 13 Mängelrüge",
    content: `Der Auftraggeber hat das Frachtgut sofort nach Auslad zu prüfen. Reklamationen wegen Verlust oder Beschädigung sind sofort bei Ablieferung des Transportgutes anzubringen und überdies dem Frachtführer innerhalb von drei Tagen schriftlich zu bestätigen. Äusserlich nicht sofort erkennbare Schäden sind dem Frachtführer innerhalb von drei Tagen seit Erbringen der Dienstleistung schriftlich anzuzeigen. Nach Ablauf dieser Fristen können keine Reklamationen mehr berücksichtigt werden.`,
    display_order: 13,
    is_active: true,
  },
  {
    title: "Art. 14 Gerichtsstand und anwendbares Recht",
    content: `Für die Beurteilung aller zwischen den Vertragsparteien strittigen Ansprüche gilt der Sitz des Frachtführers als Gerichtsstand.

Es gilt schweizerisches Recht.`,
    display_order: 14,
    is_active: true,
  },
];

const getDefaultAgbTemplates = (serviceType: string): Omit<AgbSection, 'id' | 'company_id' | 'service_type'>[] => {
  const commonTemplates = [
    {
      title: "Vorteil",
      content: `Sie bezahlen keine Anfahrt.- und Abfahrkosten, keine Kilometer.- oder Benzinkosten. Keine Spesen und keine verstecken Kosten. Erfahrene Umzugsmitarbeiter mit der Motivation das beste für Unsere Kunden zu bieten, Überdurchschnitliche Leistungen zu erbringen und ein konkurrenzfähiges Preis-Leistungsverhältnis.`,
      display_order: 0,
      is_active: true,
    },
    {
      title: "Versicherung",
      content: `Die Haftpflichtversicherung ist im Preis eingeschlossen. Verlust oder Beschädigung Ihrer Güter gemäss OR (Frachtvertrag). Wir machen darauf aufmerksam, dass der aktuelle Warenwert (Zeitwert) die Basis einer Leistung darstellt.`,
      display_order: 1,
      is_active: true,
    },
    {
      title: "Transportversicherung",
      content: `Axa Winterthur, bis CHF 200'000 pro Fahrt versichert (Police Nr.14.743.223)
Zürich Versicherung, bis CHF 5 Mio. (Police Nr.4.001.099.637)`,
      display_order: 2,
      is_active: true,
    },
    {
      title: "Schaden und Reklamation",
      content: `Bestehende Schäden an Mobiliar sind dem Umzugschef vor dem Umzug anzuzeigen. Für bestehende Kratz-, Schramm-, Druck Scheuer- und Erschütterungsschäden aller Art übernehmen wir keine Haftung.

Gestützt auf die Bestimmungen des OR-Artikel 452 Absatz 1 sind die Schäden am Frachtgut jeglicher Art sofort nach dem Umzug den Umzugs-mitarbeitern mitzuteilen und schriftlich auf der Quittung mit der Unterschrift des Kunden und des Umzugschefs festzuhalten. Die gleiche Frist- und Formvorschrift gilt ebenfalls für Schäden an Boden, Wand, Decke, Tür usw.

In Abänderung von Artikel 452 Absatz 2 und 3 (OR) sind äusserlich nicht erkennbare Schäden am Frachtgut innerhalb von 1 Tag nach dem Umzug schriftlich mitzuteilen.`,
      display_order: 3,
      is_active: true,
    },
    {
      title: "Pause",
      content: `Alle Pausen gehen zu Lasten der Firma.`,
      display_order: 4,
      is_active: true,
    },
    {
      title: "Schlussworte",
      content: `Wir hoffen, dass Sie genug Informationen erhalten haben und wir Ihr Interesse wecken konnten.

Wir sind uns bewusst, dass Sie Angebote vergleichen und das für Sie passende Angebot aussuchen. Daher ist es uns sehr wichtig, dass Sie sich jederzeit bei uns melden können und wir all Ihre Fragen beantworten und gegebenenfalls Unsicherheiten aus dem Weg schaffen können.

Uns ist der Kundenkontakt sehr wichtig und gerne nehmen wir Verbesserungsvorschläge entgegen.

Wir freuen uns sehr Sie als unserer Kunde zählen zu dürfen und garantieren Ihnen eine zuverlässige, speditive und pünktliche Ausführung. Bei Terminänderungen bitten wir Sie es uns schnellstmöglich mitzuteilen.`,
      display_order: 5,
      is_active: true,
    },
  ];

  // Service-specific customizations
  if (serviceType === "reinigung") {
    return [
      {
        title: "Leistungsumfang",
        content: `Die Reinigung umfasst alle im Angebot aufgeführten Räume und Bereiche. Nicht im Preis inbegriffen sind Arbeiten, die über die normale Endreinigung hinausgehen (z.B. Entfernung von Baustaub, Renovierungsschmutz).`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Reinigungsmittel",
        content: `Alle notwendigen Reinigungsmittel und Geräte werden von uns mitgebracht. Spezielle Reinigungsmittel für empfindliche Oberflächen werden nach Absprache verwendet.`,
        display_order: 1,
        is_active: true,
      },
      {
        title: "Abnahme",
        content: `Nach Abschluss der Reinigung empfehlen wir eine gemeinsame Abnahme vor Ort. Reklamationen müssen innerhalb von 24 Stunden schriftlich erfolgen.`,
        display_order: 2,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "entsorgung" || serviceType === "raeumung") {
    return [
      {
        title: "Entsorgung",
        content: `Die Entsorgung erfolgt fachgerecht und umweltfreundlich gemäss den geltenden Vorschriften. Sondermüll (Chemikalien, Farben, Elektronik) wird separat entsorgt und kann zusätzliche Kosten verursachen.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Wertsachen",
        content: `Wertsachen und persönliche Gegenstände sind vor der Räumung zu entfernen. Für nicht gemeldete Wertsachen übernehmen wir keine Haftung.`,
        display_order: 1,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Pause" || t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "lagerung") {
    return [
      {
        title: "Lagerungsbedingungen",
        content: `Die Lagerräume sind trocken, sauber und sicher. Der Zugang erfolgt nur nach vorheriger Anmeldung während der Geschäftszeiten.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Versicherung Lagerung",
        content: `Die eingelagerten Gegenstände sind gegen Feuer, Wasser und Diebstahl versichert. Der Versicherungswert basiert auf dem aktuellen Zeitwert der Gegenstände.`,
        display_order: 1,
        is_active: true,
      },
      {
        title: "Kündigungsfrist",
        content: `Die Lagerung kann mit einer Frist von 30 Tagen zum Monatsende gekündigt werden. Bei kürzerer Kündigungsfrist wird der volle Monat berechnet.`,
        display_order: 2,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Schlussworte"),
    ];
  }

  if (serviceType === "klaviertransport") {
    return [
      {
        title: "Spezialtransport",
        content: `Klaviere und Flügel werden von speziell geschultem Personal mit entsprechenden Hilfsmitteln transportiert. Die Instrumente werden fachgerecht verpackt und gesichert.`,
        display_order: 0,
        is_active: true,
      },
      {
        title: "Stimmung",
        content: `Nach einem Transport empfehlen wir, das Instrument ca. 2 Wochen akklimatisieren zu lassen, bevor es gestimmt wird. Die Stimmung ist nicht im Transportpreis inbegriffen.`,
        display_order: 1,
        is_active: true,
      },
      ...commonTemplates.filter(t => t.title === "Versicherung" || t.title === "Transportversicherung" || t.title === "Schaden und Reklamation" || t.title === "Schlussworte"),
    ];
  }

  // Default: Umzug — ASTAG Standard-Umzugsbedingungen (ersetzt die frühere Eigenvorlage)
  return astagUmzugTemplates;
};

export const AgbSectionEditor = ({
  companyId,
  serviceType,
  serviceLabel,
  allServiceTypes = [],
}: AgbSectionEditorProps) => {
  const { toast } = useToast();
  const t = useT();
  const [sections, setSections] = useState<AgbSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // New section form
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isAddingNew, setIsAddingNew] = useState(false);
  
  // Copy to another service type
  const [isCopying, setIsCopying] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [selectedTargetService, setSelectedTargetService] = useState<string>("");

  const fetchSections = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("agb_sections")
        .select("*")
        .eq("company_id", companyId)
        .eq("service_type", serviceType)
        .order("display_order", { ascending: true });

      if (error) throw error;
      setSections(data || []);
      
      // Auto-expand first section if exists
      if (data && data.length > 0 && data[0].id) {
        setExpandedSections(new Set([data[0].id]));
      }
    } catch (error) {
      console.error("Error fetching AGB sections:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.loadFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [companyId, serviceType, toast, t]);

  useEffect(() => {
    fetchSections();
     
  }, [fetchSections]);

  const handleAddSection = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast({
        title: t("agb.toast.requiredTitle"),
        description: t("agb.toast.requiredDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsAddingNew(true);
    try {
      const maxOrder = sections.length > 0 
        ? Math.max(...sections.map(s => s.display_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("agb_sections")
        .insert({
          company_id: companyId,
          service_type: serviceType,
          title: newTitle.trim(),
          content: newContent.trim(),
          display_order: maxOrder,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      setSections([...sections, data]);
      setNewTitle("");
      setNewContent("");
      setExpandedSections(new Set([...expandedSections, data.id]));

      toast({
        title: t("agb.toast.added"),
        description: t("agb.toast.addedDescription", { title: newTitle }),
      });
    } catch (error) {
      console.error("Error adding section:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.addFailed"),
        variant: "destructive",
      });
    } finally {
      setIsAddingNew(false);
    }
  };

  const handleUpdateSection = async (section: AgbSection) => {
    if (!section.id) return;

    setIsSaving(section.id);
    try {
      const { error } = await supabase
        .from("agb_sections")
        .update({
          title: section.title,
          content: section.content,
          is_active: section.is_active,
        })
        .eq("id", section.id);

      if (error) throw error;

      toast({
        title: t("agb.toast.saved"),
        description: t("agb.toast.savedDescription", { title: section.title }),
      });
    } catch (error) {
      console.error("Error updating section:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.saveFailed"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(null);
    }
  };

  const handleDeleteSection = async (sectionId: string, title: string) => {
    try {
      const { error } = await supabase
        .from("agb_sections")
        .delete()
        .eq("id", sectionId);

      if (error) throw error;

      setSections(sections.filter(s => s.id !== sectionId));
      toast({
        title: t("agb.toast.deleted"),
        description: t("agb.toast.deletedDescription", { title }),
      });
    } catch (error) {
      console.error("Error deleting section:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.deleteFailed"),
        variant: "destructive",
      });
    }
  };

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destinationIndex = result.destination.index;
    
    if (sourceIndex === destinationIndex) return;

    const newSections = [...sections];
    const [removed] = newSections.splice(sourceIndex, 1);
    newSections.splice(destinationIndex, 0, removed);
    
    // Update display_order for all affected sections
    const updatedSections = newSections.map((section, index) => ({
      ...section,
      display_order: index,
    }));

    setSections(updatedSections);

    // Save order to database
    try {
      await Promise.all(
        updatedSections.map((section) =>
          supabase
            .from("agb_sections")
            .update({ display_order: section.display_order })
            .eq("id", section.id!)
        )
      );
      
      toast({
        title: t("agb.toast.reordered"),
        description: t("agb.toast.reorderedDescription"),
      });
    } catch (error) {
      console.error("Error reordering sections:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.reorderFailed"),
        variant: "destructive",
      });
      // Revert on error
      fetchSections();
    }
  };

  const handleLoadDefaultTemplates = async () => {
    if (sections.length > 0) {
      toast({
        title: t("agb.toast.notice"),
        description: t("agb.toast.templatesExist"),
        variant: "destructive",
      });
      return;
    }

    setIsLoadingDefaults(true);
    try {
      const templates = getDefaultAgbTemplates(serviceType);
      
      const sectionsToInsert = templates.map((template, index) => ({
        company_id: companyId,
        service_type: serviceType,
        title: template.title,
        content: template.content,
        display_order: index,
        is_active: true,
      }));

      const { data, error } = await supabase
        .from("agb_sections")
        .insert(sectionsToInsert)
        .select();

      if (error) throw error;

      setSections(data || []);
      
      if (data && data.length > 0) {
        setExpandedSections(new Set([data[0].id]));
      }

      toast({
        title: t("agb.toast.templatesLoaded"),
        description: t("agb.toast.templatesLoadedDescription", { count: data?.length ?? 0 }),
      });
    } catch (error) {
      console.error("Error loading default templates:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.templatesFailed"),
        variant: "destructive",
      });
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const toggleExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const updateSectionField = (sectionId: string, field: keyof AgbSection, value: string | boolean) => {
    setSections(sections.map(s => 
      s.id === sectionId ? { ...s, [field]: value } : s
    ));
  };

  const handleCopyToServiceType = async () => {
    if (!selectedTargetService) {
      toast({
        title: t("common.error"),
        description: t("agb.toast.selectTarget"),
        variant: "destructive",
      });
      return;
    }

    const activeSections = sections.filter(s => s.is_active);
    if (activeSections.length === 0) {
      toast({
        title: t("agb.toast.noActive"),
        description: t("agb.toast.noActiveDescription"),
        variant: "destructive",
      });
      return;
    }

    setIsCopying(true);
    try {
      // Check if target already has sections
      const { data: existingSections, error: checkError } = await supabase
        .from("agb_sections")
        .select("id")
        .eq("company_id", companyId)
        .eq("service_type", selectedTargetService);

      if (checkError) throw checkError;

      // Get max display order for target service
      const { data: maxOrderData } = await supabase
        .from("agb_sections")
        .select("display_order")
        .eq("company_id", companyId)
        .eq("service_type", selectedTargetService)
        .order("display_order", { ascending: false })
        .limit(1);

      const startOrder = maxOrderData && maxOrderData.length > 0 
        ? (maxOrderData[0].display_order || 0) + 1 
        : 0;

      // Copy sections to target service type
      const sectionsToInsert = activeSections.map((section, index) => ({
        company_id: companyId,
        service_type: selectedTargetService,
        title: section.title,
        content: section.content,
        display_order: startOrder + index,
        is_active: true,
      }));

      const { error: insertError } = await supabase
        .from("agb_sections")
        .insert(sectionsToInsert);

      if (insertError) throw insertError;

      const targetLabel = allServiceTypes.find(s => s.type === selectedTargetService)?.label || selectedTargetService;
      const appended = existingSections && existingSections.length > 0;

      toast({
        title: t("agb.toast.copied"),
        description:
          t("agb.toast.copiedDescription", {
            count: activeSections.length,
            target: targetLabel,
          }) + (appended ? t("agb.toast.copiedAppended") : ""),
      });

      setCopyDialogOpen(false);
      setSelectedTargetService("");
    } catch (error) {
      console.error("Error copying sections:", error);
      toast({
        title: t("common.error"),
        description: t("agb.toast.copyFailed"),
        variant: "destructive",
      });
    } finally {
      setIsCopying(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-muted-foreground" />
          <h4 className="font-medium">{t("agb.headingFor", { service: serviceLabel })}</h4>
          <Badge variant="secondary">
            {t("agb.sectionCount", { count: sections.filter(s => s.is_active).length })}
          </Badge>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy to another service type */}
          {sections.filter(s => s.is_active).length > 0 && allServiceTypes.length > 1 && (
            <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Copy className="w-4 h-4 mr-2" />
                  {t("common.copy")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Copy className="w-5 h-5" />
                    {t("agb.copy.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("agb.copy.description", {
                      count: sections.filter(s => s.is_active).length,
                    })}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label className="text-sm mb-2 block">{t("agb.copy.targetLabel")}</Label>
                    <Select value={selectedTargetService} onValueChange={setSelectedTargetService}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("agb.copy.targetPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {allServiceTypes
                          .filter(s => s.type !== serviceType)
                          .map(s => (
                            <SelectItem key={s.type} value={s.type}>
                              {s.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("agb.copy.hint")}
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    onClick={handleCopyToServiceType}
                    disabled={isCopying || !selectedTargetService}
                  >
                    {isCopying ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Copy className="w-4 h-4 mr-2" />
                    )}
                    {t("common.copy")}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
          
          {sections.filter(s => s.is_active).length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="w-4 h-4 mr-2" />
                  {t("agb.pdfPreview")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    {t("agb.pdfPreview.title")}
                  </DialogTitle>
                  <DialogDescription>
                    {t("agb.pdfPreview.description")}
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-4">
                  <div className="bg-white border rounded-lg p-6 shadow-sm">
                    {/* Preview chrome — operator-facing. The section title/content below stay
                        as authored in the DB: they are the CUSTOMER's document text. */}
                    <div className="bg-primary text-primary-foreground rounded-md px-4 py-3 mb-6 text-center">
                      <h2 className="font-bold text-lg">{t("agb.pdfPreview.heading")}</h2>
                    </div>

                    <p className="text-sm text-muted-foreground mb-6 italic">
                      {t("agb.pdfPreview.intro")}
                    </p>

                    <div className="space-y-6">
                      {sections.filter(s => s.is_active).map((section, index) => (
                        <div key={section.id} className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
                          <h3 className="font-semibold text-primary mb-2">{section.title}</h3>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                            {section.content}
                          </p>
                          {index < sections.filter(s => s.is_active).length - 1 && (
                            <Separator className="mt-4" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          )}
          
          {sections.length === 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleLoadDefaultTemplates}
              disabled={isLoadingDefaults}
            >
              {isLoadingDefaults ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4 mr-2" />
              )}
              {t("agb.loadTemplates")}
            </Button>
          )}
        </div>
      </div>

      {/* Existing Sections */}
      {sections.length > 0 ? (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="agb-sections">
            {(provided) => (
              <div 
                {...provided.droppableProps} 
                ref={provided.innerRef}
                className="space-y-3"
              >
                {sections.map((section, index) => (
                  <Draggable 
                    key={section.id} 
                    draggableId={section.id!} 
                    index={index}
                  >
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                      >
                        <Card className={`${!section.is_active ? "opacity-50" : ""} ${snapshot.isDragging ? "shadow-lg ring-2 ring-primary" : ""}`}>
                          <Collapsible 
                            open={expandedSections.has(section.id!)}
                            onOpenChange={() => toggleExpanded(section.id!)}
                          >
                            <CardHeader className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div 
                                  {...provided.dragHandleProps}
                                  className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-muted rounded transition-colors"
                                >
                                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                                </div>

                                <CollapsibleTrigger asChild>
                                  <div className="flex-1 cursor-pointer">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-sm sm:text-base truncate max-w-[150px] sm:max-w-none">
                                          {section.title}
                                        </span>
                                        {!section.is_active && (
                                          <Badge variant="outline" className="text-xs">{t("agb.inactive")}</Badge>
                                        )}
                                      </div>
                                      <ChevronDown 
                                        className={`w-4 h-4 transition-transform ${
                                          expandedSections.has(section.id!) ? "rotate-180" : ""
                                        }`}
                                      />
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                              </div>
                            </CardHeader>

                            <CollapsibleContent>
                              <CardContent className="pt-0 pb-4 px-4 space-y-4">
                                <Separator />
                                
                                <div>
                                  <Label className="text-sm">{t("agb.field.title")}</Label>
                                  <Input
                                    value={section.title}
                                    onChange={(e) => updateSectionField(section.id!, "title", e.target.value)}
                                    placeholder={t("agb.field.titlePlaceholder")}
                                    className="mt-1"
                                  />
                                </div>

                                <div>
                                  <Label className="text-sm">{t("agb.field.content")}</Label>
                                  <Textarea
                                    value={section.content}
                                    onChange={(e) => updateSectionField(section.id!, "content", e.target.value)}
                                    rows={6}
                                    placeholder={t("agb.field.contentPlaceholder")}
                                    className="mt-1 font-mono text-sm"
                                  />
                                </div>

                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={section.is_active}
                                      onChange={(e) => updateSectionField(section.id!, "is_active", e.target.checked)}
                                      className="w-4 h-4 rounded border-border"
                                    />
                                    <span className="text-sm">{t("agb.active")}</span>
                                  </label>

                                  <div className="flex gap-2">
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm">
                                          <Trash2 className="w-4 h-4 sm:mr-2" />
                                          <span className="hidden sm:inline">{t("common.delete")}</span>
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>{t("agb.delete.title")}</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            {t("agb.delete.description", { title: section.title })}
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteSection(section.id!, section.title)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            {t("common.delete")}
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>

                                    <Button
                                      onClick={() => handleUpdateSection(section)}
                                      disabled={isSaving === section.id}
                                      size="sm"
                                    >
                                      {isSaving === section.id ? (
                                        <Loader2 className="w-4 h-4 animate-spin sm:mr-2" />
                                      ) : (
                                        <Save className="w-4 h-4 sm:mr-2" />
                                      )}
                                      <span className="hidden sm:inline">{t("common.save")}</span>
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </CollapsibleContent>
                          </Collapsible>
                        </Card>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      ) : (
        <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
          <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>{t("agb.empty", { service: serviceLabel })}</p>
          <p className="text-sm mb-4">{t("agb.emptyHint")}</p>
          <Button
            variant="secondary"
            onClick={handleLoadDefaultTemplates}
            disabled={isLoadingDefaults}
          >
            {isLoadingDefaults ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-2" />
            )}
            {t("agb.loadDefaultTemplates")}
          </Button>
        </div>
      )}

      {/* Add New Section */}
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t("agb.add.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label className="text-sm">{t("agb.field.title")} *</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder={t("agb.add.titlePlaceholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm">{t("agb.field.content")} *</Label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                placeholder={t("agb.add.contentPlaceholder")}
                className="mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleAddSection}
              disabled={isAddingNew || !newTitle.trim() || !newContent.trim()}
            >
              {isAddingNew ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Plus className="w-4 h-4 mr-2" />
              )}
              {t("agb.add.button")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
