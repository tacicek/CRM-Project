import { describe, expect, it } from "vitest";
import {
  geaenderteMigrationen,
  leseKorrekturen,
  ohneKorrektureintrag,
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
});
