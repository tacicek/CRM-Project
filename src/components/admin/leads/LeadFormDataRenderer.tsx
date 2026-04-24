import React from "react";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Package, Calendar, Home, Phone, Mail, Clock, FileText } from "lucide-react";
import { translateKey, translateValue } from "./utils";
import { MAX_RECURSION_DEPTH } from "./types";

function renderValue(key: string, value: unknown, depth = 0): React.ReactNode {
  if (depth > MAX_RECURSION_DEPTH) {
    return <div key={key} className="text-sm text-muted-foreground">[Zu tief verschachtelt]</div>;
  }
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") {
    return (
      <div key={key} className="flex items-center gap-2">
        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${value ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
          {value ? "\u2713" : "\u2717"}
        </span>
        <span className="text-sm">{translateKey(key)}</span>
      </div>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    return (
      <div key={key} className="space-y-1">
        <div className="text-xs text-muted-foreground font-medium">{translateKey(key)}:</div>
        <div className="flex flex-wrap gap-1">
          {value.map((item, idx) => {
            if (typeof item === "object" && item !== null) {
              const o = item as Record<string, unknown>;
              if (o.name && o.anzahl) {
                return <Badge key={idx} variant="outline" className="text-xs">{String(o.anzahl)}× {String(o.name)}</Badge>;
              }
              return (
                <div key={idx} className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border">
                  {Object.entries(o).map(([k, v]) => <span key={k} className="mr-2">{translateKey(k)}: <strong>{translateValue(String(v))}</strong></span>)}
                </div>
              );
            }
            return <Badge key={idx} variant="secondary" className="text-xs">{translateValue(String(item))}</Badge>;
          })}
        </div>
      </div>
    );
  }

  if (typeof value === "object" && value !== null) {
    const objValue = value as Record<string, unknown>;
    const entries = Object.entries(objValue).filter(([, v]) => v !== null && v !== undefined && v !== "");
    if (entries.length === 0) return null;

    if (objValue.strasse || objValue.plz || objValue.ort) {
      const street = objValue.strasse ? `${objValue.strasse} ${objValue.hausnummer || ""}`.trim() : "";
      const location = `${objValue.plz || ""} ${objValue.ort || ""}`.trim();
      return (
        <div key={key} className="text-sm">
          <span className="text-muted-foreground">{translateKey(key)}:</span>
          <div className="font-medium">
            {street && <div>{street}</div>}
            {location && <div>{location}</div>}
          </div>
        </div>
      );
    }

    if (key === "lift" && objValue.vorhanden !== undefined) {
      return (
        <div key={key} className="text-sm flex items-center gap-2">
          <span className="text-muted-foreground">Lift:</span>
          <span className="font-medium">{objValue.vorhanden ? `Ja (${translateKey(String(objValue.typ || "vorhanden"))})` : "Nein"}</span>
        </div>
      );
    }

    return (
      <div key={key} className={`space-y-2 ${depth > 0 ? "pl-3 border-l-2 border-muted" : ""}`}>
        <div className="text-sm font-medium text-muted-foreground">{translateKey(key)}:</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {entries.map(([k, v]) => renderValue(k, v, depth + 1))}
        </div>
      </div>
    );
  }

  return (
    <div key={key} className="text-sm">
      <span className="text-muted-foreground">{translateKey(key)}:</span>
      <span className="font-medium ml-2">{translateValue(String(value))}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InfoRow — compact key-value display
// ---------------------------------------------------------------------------

function InfoRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (value === null || value === undefined || value === "" || value === 0) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      {icon && <span className="mt-0.5 text-muted-foreground">{icon}</span>}
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detect new wizard format (form_version=2 or flat keys like unterkunft/str/ort)
// ---------------------------------------------------------------------------

function isNewWizardData(data: Record<string, unknown>): boolean {
  return !!(data.unterkunft || data.str || data.vonStr || data.kat || data.lart || data.rart || data.zweck || data.dl || data.umzugsart);
}

// ---------------------------------------------------------------------------
// New Wizard Renderer — structured display for v2 form data
// ---------------------------------------------------------------------------

function NewWizardRenderer({ data }: { data: Record<string, unknown> }) {
  const d = data;

  const unterkunft = d.unterkunft as string | undefined;
  const m2 = d.m2 as number | undefined;
  const zimmer = d.zimmer as string | number | undefined;
  const bad = d.bad as number | undefined;
  const wc = d.wc as number | undefined;

  const str = (d.str || d.vonStr) as string | undefined;
  const nr = (d.nr || d.vonNr) as string | undefined;
  const plz = (d.plz || d.vonPlz) as string | undefined;
  const ort = (d.ort || d.vonOrt) as string | undefined;
  const stock = d.stock || d.vonStock;
  const lift = d.lift ?? d.vonLift;

  const nachStr = d.nachStr as string | undefined;
  const nachNr = d.nachNr as string | undefined;
  const nachPlz = d.nachPlz as string | undefined;
  const nachOrt = d.nachOrt as string | undefined;
  const nachStock = d.nachStock;
  const nachLift = d.nachLift;

  const anrede = d.anrede as string | undefined;
  const vorname = d.vorname as string | undefined;
  const nachname = d.nachname as string | undefined;
  const email = d.email as string | undefined;
  const tel = d.tel as string | undefined;
  const zeit = d.zeit as string | undefined;

  const date = d.date as string | undefined;
  const flex = d.flex as string | undefined;
  const offerten = d.offerten as number | undefined;
  const bemerkungen = d.bemerkungen as string | undefined;

  const rooms = d.rooms as string[] | undefined;
  const besonderheiten = d.besonderheiten as string[] | undefined;
  const zusatzleistungen = d.zusatzleistungen as string[] | unknown | undefined;

  const balkon = d.balkon as boolean | undefined;
  const storen = d.storen as boolean | undefined;
  const storenCount = d.storen_count as number | undefined;
  const fenNormal = d.fen_normal as number | undefined;
  const fenGross = d.fen_gross as number | undefined;
  const fenTuer = d.fen_tuer as number | undefined;
  const balkonM2 = d.balkon_m2 as number | undefined;

  // Räumung-specific
  const rart = d.rart as string | undefined;
  const vol = d.vol as string | undefined;
  const dring = d.dring as string | undefined;
  const schwer = d.schwer as string | undefined;
  const svcType = d.svcType as string | undefined;

  // Lagerung
  const lart = d.lart as string | undefined;
  const grosse = d.grosse as string | undefined;
  const dauer = d.dauer as string | number | undefined;
  const abholung = d.abholung as boolean | undefined;
  const wasText = d.wasText as string | undefined;

  // Möbellift
  const zweck = d.zweck as string | undefined;
  const was = d.was as string | undefined;
  const richtung = d.richtung as string | undefined;

  // Klaviertransport
  const dl = d.dl as string | undefined;
  const inst = d.inst as string | undefined;

  // Spezialtransport
  const kat = d.kat as string | undefined;
  const detailAnswer = d.detailAnswer as string | undefined;

  // Umzug
  const umzugsart = d.umzugsart as string | undefined;

  const formatStock = (s: unknown) => {
    if (!s) return null;
    if (typeof s === "object" && s !== null) {
      const obj = s as Record<string, unknown>;
      return obj.label || obj.l || `${obj.floor || 0}. OG`;
    }
    return translateValue(String(s));
  };

  const hasVonAddr = str || plz || ort;
  const hasNachAddr = nachStr || nachPlz || nachOrt;

  return (
    <div className="space-y-3">
      {/* Objekt / Service Info */}
      {(unterkunft || umzugsart || rart || lart || zweck || kat || dl) && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
          <h5 className="text-xs font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Home className="w-3.5 h-3.5" /> Objekt & Service
          </h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {unterkunft && <InfoRow label="Unterkunft" value={translateValue(unterkunft)} />}
            {umzugsart && <InfoRow label="Umzugsart" value={translateValue(umzugsart)} />}
            {rart && <InfoRow label="Räumungsart" value={translateValue(rart)} />}
            {svcType && <InfoRow label="Service" value={translateValue(svcType)} />}
            {lart && <InfoRow label="Lagerart" value={translateValue(lart)} />}
            {grosse && <InfoRow label="Grösse" value={translateValue(grosse)} />}
            {zweck && <InfoRow label="Zweck" value={translateValue(zweck)} />}
            {was && <InfoRow label="Was" value={translateValue(was)} />}
            {richtung && <InfoRow label="Richtung" value={translateValue(richtung)} />}
            {dl && <InfoRow label="Dienstleistung" value={translateValue(dl)} />}
            {inst && <InfoRow label="Instrument" value={translateValue(inst)} />}
            {kat && <InfoRow label="Kategorie" value={translateValue(kat)} />}
            {detailAnswer && <InfoRow label="Details" value={translateValue(detailAnswer)} />}
            {zimmer && <InfoRow label="Zimmer" value={zimmer} />}
            {m2 !== undefined && m2 > 0 && <InfoRow label="Wohnfläche" value={`${m2} m²`} />}
            {bad !== undefined && bad > 0 && <InfoRow label="Badezimmer" value={bad} />}
            {wc !== undefined && wc > 0 && <InfoRow label="WC" value={wc} />}
            {vol && <InfoRow label="Volumen" value={translateValue(vol)} />}
            {dring && <InfoRow label="Dringlichkeit" value={translateValue(dring)} />}
            {schwer && <InfoRow label="Schwere Gegenstände" value={translateValue(schwer)} />}
            {dauer && <InfoRow label="Dauer" value={typeof dauer === "number" ? `${dauer} Monate` : translateValue(String(dauer))} />}
            {abholung !== undefined && <InfoRow label="Abholung" value={abholung ? "Ja" : "Nein"} />}
            {wasText && <InfoRow label="Lagerinhalt" value={wasText} />}
            {offerten && <InfoRow label="Offerten" value={`${offerten} Firmen`} />}
          </div>
        </div>
      )}

      {/* Adressen */}
      {(hasVonAddr || hasNachAddr) && (
        <div className={`grid grid-cols-1 ${hasNachAddr ? "md:grid-cols-2" : ""} gap-3`}>
          {hasVonAddr && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200">
              <h5 className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {hasNachAddr ? "Von (Auszug)" : "Adresse"}
              </h5>
              <div className="space-y-1">
                <div className="text-sm font-medium">{str} {nr}</div>
                <div className="text-sm">{plz} {ort}</div>
                {stock && <div className="text-xs text-muted-foreground">Stockwerk: {formatStock(stock)}</div>}
                {lift !== undefined && <div className="text-xs text-muted-foreground">Lift: {lift ? "Ja" : "Nein"}</div>}
              </div>
            </div>
          )}
          {hasNachAddr && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
              <h5 className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Nach (Einzug)
              </h5>
              <div className="space-y-1">
                <div className="text-sm font-medium">{nachStr} {nachNr}</div>
                <div className="text-sm">{nachPlz} {nachOrt}</div>
                {nachStock && <div className="text-xs text-muted-foreground">Stockwerk: {formatStock(nachStock)}</div>}
                {nachLift !== undefined && <div className="text-xs text-muted-foreground">Lift: {nachLift ? "Ja" : "Nein"}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Räume & Extras */}
      {((rooms && rooms.length > 0) || balkon !== undefined || storen !== undefined || fenNormal || fenGross || fenTuer || besonderheiten) && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
          <h5 className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Details & Extras
          </h5>
          <div className="space-y-2">
            {rooms && rooms.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Räume: </span>
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {rooms.map(r => <Badge key={r} variant="secondary" className="text-xs">{translateValue(r)}</Badge>)}
                </span>
              </div>
            )}
            <div className="flex flex-wrap gap-3 text-sm">
              {balkon !== undefined && (
                <span className={balkon ? "text-green-600" : "text-gray-400"}>{balkon ? "✓" : "✗"} Balkon {balkonM2 ? `(${balkonM2} m²)` : ""}</span>
              )}
              {storen !== undefined && (
                <span className={storen ? "text-green-600" : "text-gray-400"}>{storen ? "✓" : "✗"} Storen {storenCount ? `(${storenCount} Stk.)` : ""}</span>
              )}
            </div>
            {(fenNormal || fenGross || fenTuer) && (
              <div className="text-sm">
                <span className="text-muted-foreground">Fenster: </span>
                {fenNormal ? `${fenNormal} Normal` : ""}{fenGross ? `, ${fenGross} Gross` : ""}{fenTuer ? `, ${fenTuer} Türen` : ""}
              </div>
            )}
            {besonderheiten && besonderheiten.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Besonderheiten: </span>
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {besonderheiten.map(b => <Badge key={b} variant="outline" className="text-xs">{translateValue(b)}</Badge>)}
                </span>
              </div>
            )}
            {zusatzleistungen && Array.isArray(zusatzleistungen) && (zusatzleistungen as string[]).length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground">Zusatzleistungen: </span>
                <span className="flex flex-wrap gap-1 mt-0.5">
                  {(zusatzleistungen as string[]).map(z => <Badge key={z} variant="secondary" className="text-xs bg-blue-50 text-blue-700">{translateValue(z)}</Badge>)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Termin */}
      {(date || flex) && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200">
          <h5 className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" /> Termin
          </h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {date && <InfoRow label="Datum" value={date} />}
            {flex && <InfoRow label="Flexibilität" value={translateValue(flex)} />}
            {zeit && <InfoRow label="Kontaktzeit" value={translateValue(zeit)} />}
          </div>
        </div>
      )}

      {/* Kontakt */}
      {(vorname || email || tel) && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Kontaktdaten
          </h5>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {anrede && <InfoRow label="Anrede" value={translateValue(anrede)} />}
            {vorname && <InfoRow label="Name" value={`${vorname} ${nachname || ""}`} />}
            {email && <InfoRow label="E-Mail" value={email} icon={<Mail className="w-3 h-3" />} />}
            {tel && <InfoRow label="Telefon" value={tel} icon={<Phone className="w-3 h-3" />} />}
            {zeit && <InfoRow label="Erreichbar" value={translateValue(zeit)} icon={<Clock className="w-3 h-3" />} />}
          </div>
        </div>
      )}

      {/* Bemerkungen */}
      {bemerkungen && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <h5 className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Bemerkungen
          </h5>
          <p className="text-sm whitespace-pre-wrap">{bemerkungen}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Zusatzleistungen section (old format)
// ---------------------------------------------------------------------------

function ZusatzleistungenSection({ services }: { services: Record<string, unknown> }) {
  const entries = Object.entries(services).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <h6 className="text-sm font-medium text-gray-700 dark:text-gray-200 border-b pb-1">Zusatzleistungen</h6>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map(([serviceName, serviceValue]) => {
          if (typeof serviceValue === "boolean") {
            return (
              <div key={serviceName} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded border">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${serviceValue ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  {serviceValue ? "\u2713" : "\u2717"}
                </span>
                <span className="text-sm">{translateKey(serviceName)}</span>
              </div>
            );
          }
          if (typeof serviceValue === "object" && serviceValue !== null) {
            const svcObj = serviceValue as Record<string, unknown>;
            const isActive = svcObj.aktiv === true;
            const details: string[] = [];
            if (svcObj.standort) details.push(`Standort: ${translateValue(String(svcObj.standort))}`);
            if (svcObj.umfang) details.push(`Umfang: ${translateValue(String(svcObj.umfang))}`);
            if (svcObj.volumen_m3 !== undefined && svcObj.volumen_m3 !== 0) details.push(`${String(svcObj.volumen_m3)} m\u00b3`);
            if (svcObj.dauer_wochen !== undefined && svcObj.dauer_wochen !== 0) details.push(`${String(svcObj.dauer_wochen)} Wochen`);
            return (
              <div key={serviceName} className={`p-2 rounded border ${isActive ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200" : "bg-white dark:bg-gray-700"}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                    {isActive ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-sm font-medium">{translateKey(serviceName)}</span>
                </div>
                {details.length > 0 && isActive && (
                  <div className="text-xs text-muted-foreground ml-7">{details.join(" \u2022 ")}</div>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface LeadFormDataRendererProps {
  data: Record<string, unknown>;
}

export function LeadFormDataRenderer({ data }: LeadFormDataRendererProps) {
  if (isNewWizardData(data)) {
    return <NewWizardRenderer data={data} />;
  }

  // Legacy format
  const mainSections = ["kunde", "auszug", "einzug", "inventar", "termin"];
  const otherKeys = Object.keys(data).filter(
    (k) => !mainSections.includes(k) && data[k] !== null && data[k] !== undefined
  );

  return (
    <div className="space-y-4">
      {data.kunde && (
        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border">
          <h5 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" /> Kundendaten
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.kunde as Record<string, unknown>).filter(([, v]) => v).map(([k, v]) => renderValue(k, v))}
          </div>
        </div>
      )}

      {(data.auszug || data.einzug) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.auszug && (
            <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200">
              <h5 className="text-sm font-semibold text-orange-600 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Auszug (Von)
              </h5>
              <div className="space-y-1">
                {renderValue("adresse", (data.auszug as Record<string, unknown>).adresse)}
                {renderValue("stockwerk", (data.auszug as Record<string, unknown>).stockwerk)}
                {renderValue("lift", (data.auszug as Record<string, unknown>).lift)}
                {renderValue("anzahl_zimmer", (data.auszug as Record<string, unknown>).anzahl_zimmer)}
                {renderValue("wohnflaeche_m2", (data.auszug as Record<string, unknown>).wohnflaeche_m2)}
                {renderValue("property_type", (data.auszug as Record<string, unknown>).property_type)}
                {renderValue("parkplatz", (data.auszug as Record<string, unknown>).parkplatz)}
              </div>
            </div>
          )}
          {data.einzug && (
            <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200">
              <h5 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Einzug (Nach)
              </h5>
              <div className="space-y-1">
                {renderValue("adresse", (data.einzug as Record<string, unknown>).adresse)}
                {renderValue("stockwerk", (data.einzug as Record<string, unknown>).stockwerk)}
                {renderValue("lift", (data.einzug as Record<string, unknown>).lift)}
                {renderValue("anzahl_zimmer", (data.einzug as Record<string, unknown>).anzahl_zimmer)}
                {renderValue("wohnflaeche_m2", (data.einzug as Record<string, unknown>).wohnflaeche_m2)}
                {renderValue("property_type", (data.einzug as Record<string, unknown>).property_type)}
                {renderValue("parkplatz", (data.einzug as Record<string, unknown>).parkplatz)}
              </div>
            </div>
          )}
        </div>
      )}

      {data.inventar && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200">
          <h5 className="text-sm font-semibold text-purple-600 mb-2 flex items-center gap-2">
            <Package className="w-4 h-4" /> Inventar
          </h5>
          {renderValue("items", (data.inventar as Record<string, unknown>).items)}
        </div>
      )}

      {data.termin && (
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200">
          <h5 className="text-sm font-semibold text-blue-600 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Terminwunsch
          </h5>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.termin as Record<string, unknown>).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => renderValue(k, v))}
          </div>
        </div>
      )}

      {otherKeys.length > 0 && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border">
          <h5 className="text-sm font-semibold text-gray-600 dark:text-gray-300 mb-3">Weitere Angaben</h5>
          <div className="space-y-4">
            {otherKeys.map((key) => {
              const value = data[key];
              if (value === null || value === undefined) return null;
              if (key === "zusatzleistungen" && typeof value === "object") {
                return <ZusatzleistungenSection key={key} services={value as Record<string, unknown>} />;
              }
              return <div key={key} className="space-y-1">{renderValue(key, value)}</div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
