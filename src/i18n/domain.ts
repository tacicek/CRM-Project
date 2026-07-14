import type { Locale } from "@/i18n/locale";
import { createTranslator, type MessageKey } from "@/i18n/translator";

/**
 * Locale-aware domain vocabulary.
 *
 * Replaces the German-only label maps that were re-declared across the codebase
 * (`SERVICE_LABELS`, `AUFTRAG_STATUS_LABELS`, `RECHNUNG_STATUS_LABELS`, the local
 * `STATUS_META` objects in Offerten.tsx / Auftraege.tsx / Kalender.tsx, …).
 *
 * Every function takes the locale explicitly, so the same helper serves the
 * dashboard (operator locale) and the PDFs/e-mails (customer locale) without the
 * two ever leaking into each other.
 */

/**
 * Service types arrive from the DB as free text with historic spellings
 * ("umzug_privat", "Privatumzug", "möbellift", "moebellift"). Normalise to a
 * catalog key before looking up a label — the old code did this with German
 * substring matching scattered across three files.
 */
export const normalizeServiceKey = (serviceType: string | null | undefined): string => {
  if (!serviceType) return "allgemein";
  const s = serviceType.toLowerCase().trim().replace(/[\s-]+/g, "_");

  if (s.includes("umzug") || s.includes("zügel")) {
    if (s.includes("firma") || s.includes("gesch")) return "umzug_firma";
    if (s.includes("buero") || s.includes("büro") || s.includes("office")) return "umzug_buero";
    if (s.includes("international")) return "umzug_international";
    if (s.includes("privat")) return "umzug_privat";
    return "umzug";
  }
  if (s.includes("klavier") || s.includes("piano")) return "klaviertransport";
  if (s.includes("moebellift") || s.includes("möbellift")) return "moebellift";
  if (s.includes("transport")) return "transport";
  if (s.includes("reinig") || s.includes("putz")) return "reinigung";
  if (s.includes("raeum") || s.includes("räum")) return "raeumung";
  if (s.includes("entsorg")) return "entsorgung";
  if (s.includes("lager")) return "lagerung";
  if (s.includes("maler")) return "malerarbeit";
  if (s.includes("renovation") || s.includes("renovier")) return "renovation";
  return "allgemein";
};

const label = (locale: Locale, key: string, fallbackKey: string): string => {
  const t = createTranslator(locale);
  const translated = t(key as MessageKey);
  // createTranslator returns the key itself when nothing matched — treat that as a miss.
  return translated === key ? t(fallbackKey as MessageKey) : translated;
};

/** "Umzug" · "Déménagement" · "Removal" */
export const getServiceLabel = (serviceType: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.service.${normalizeServiceKey(serviceType)}`, "domain.service.allgemein");

/** "Umzugstermin" · "Date du déménagement" · "Removal date" */
export const getAppointmentLabel = (
  serviceType: string | null | undefined,
  locale: Locale
): string => {
  const key = normalizeServiceKey(serviceType);
  // The appointment catalog is keyed by base service, not by variant.
  const base = key.startsWith("umzug") ? "umzug" : key;
  return label(locale, `domain.appointment.${base}`, "domain.appointment.default");
};

export interface AddressLabels {
  primary: string;
  secondary: string;
}

/** Address card headers, e.g. Auszugsadresse / Einzugsadresse for a removal. */
export const getAddressLabels = (
  serviceType: string | null | undefined,
  locale: Locale
): AddressLabels => {
  const key = normalizeServiceKey(serviceType);
  const base = key.startsWith("umzug") ? "umzug" : key;
  return {
    primary: label(locale, `domain.address.${base}.primary`, "domain.address.default.primary"),
    secondary: label(
      locale,
      `domain.address.${base}.secondary`,
      "domain.address.default.secondary"
    ),
  };
};

export const getOfferStatusLabel = (status: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.offerStatus.${status ?? "draft"}`, "domain.offerStatus.draft");

export const getAuftragStatusLabel = (status: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.auftragStatus.${status ?? "geplant"}`, "domain.auftragStatus.geplant");

export const getRechnungStatusLabel = (status: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.rechnungStatus.${status ?? "entwurf"}`, "domain.rechnungStatus.entwurf");

export const getQuittungStatusLabel = (status: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.quittungStatus.${status ?? "draft"}`, "domain.quittungStatus.draft");

export const getAppointmentStatusLabel = (
  status: string | null | undefined,
  locale: Locale
): string =>
  label(locale, `domain.appointmentStatus.${status ?? "pending"}`, "domain.appointmentStatus.pending");

export const getAppointmentTypeLabel = (type: string | null | undefined, locale: Locale): string =>
  label(locale, `domain.appointmentType.${type ?? "service"}`, "domain.appointmentType.service");

export const getYesNo = (value: boolean | null | undefined, locale: Locale): string =>
  createTranslator(locale)(value ? "domain.yes" : "domain.no");

/**
 * Formal letter salutation.
 *
 * The old `detectSalutation()` guessed gender from the last letter of the first
 * name — a heuristic that is wrong often enough in German and meaningless in
 * French or English. It is replaced by the stored `customer_salutation`, falling
 * back to the neutral form when the field is empty. Guessing a customer's gender
 * on an invoice is not a defect worth porting to two more languages.
 */
export const getLetterSalutation = (
  salutation: string | null | undefined,
  lastName: string | null | undefined,
  locale: Locale
): string => {
  const t = createTranslator(locale);
  const s = salutation?.toLowerCase().trim();
  if (!lastName) return t("domain.salutation.letter.neutral");
  if (s === "herr" || s === "mr" || s === "monsieur")
    return t("domain.salutation.letter.herr", { lastName });
  if (s === "frau" || s === "ms" || s === "mrs" || s === "madame")
    return t("domain.salutation.letter.frau", { lastName });
  return t("domain.salutation.letter.neutral");
};
