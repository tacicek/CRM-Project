import { describe, expect, it } from "vitest";
import {
  digestBefunde,
  geaenderteMigrationen,
  leseKorrekturen,
  ohneKorrektureintrag,
  unberichtigteDigests,
} from "../artifact-corrections";

describe("Artefakt-Korrekturen", () => {
  it("jede geänderte Migrationsdatei hat einen Korrektureintrag", () => {
    expect(
      ohneKorrektureintrag()
        .map((g) => `${g.pfad}\n    ${g.sha256Erste.slice(0, 16)} → ${g.sha256Aktuell.slice(0, 16)}`)
        .join("\n"),
    ).toBe("");
  });

  it("das Tor misst überhaupt etwas", () => {
    // Wären es null geänderte Dateien, wäre der Test oben trivial grün.
    expect(geaenderteMigrationen().length).toBeGreaterThan(0);
  });

  it("jeder Eintrag trägt eine Kennung und eine Einstufung", () => {
    for (const k of leseKorrekturen()) {
      expect(k.record_id, JSON.stringify(k).slice(0, 80)).toMatch(/^AC-/);
      expect(k.classification.length).toBeGreaterThan(3);
    }
  });

  it("jeder eingetragene Digest entspricht einem echten Git-Objekt — oder ist berichtigt", () => {
    expect(
      unberichtigteDigests()
        .map(
          (b) =>
            `${b.record_id}.${b.feld}${b.nichtNachrechenbar ? " (kein Commit-Bezug — nicht nachrechenbar)" : ""}\n      eingetragen ${b.eingetragen}\n      tatsächlich  ${b.tatsaechlich ?? "(nicht ermittelbar)"}`,
        )
        .join("\n"),
    ).toBe("");
  });

  it("der eine bekannte Falscheintrag ist als berichtigt geführt, nicht gelöscht", () => {
    // AC-0006.sha256_previous war handgetippt. Er bleibt im anfügenden Protokoll
    // stehen und wird von AC-0008 berichtigt — beides muss wahr bleiben.
    const bekannt = digestBefunde().filter((b) => b.record_id === "AC-0006");
    expect(bekannt).toHaveLength(1);
    expect(bekannt[0].spaeterBerichtigt).toBe(true);
  });
});
