import { describe, expect, it } from "vitest";
import { findeGerateneMandantenQuellen } from "../mandanten-quelle";

describe("Mandantenquelle", () => {
  it("niemand raet die Firma", () => {
    const funde = findeGerateneMandantenQuellen();
    // Schlaegt dieses Tor an, ist irgendwo wieder eine zweite Antwort auf
    // "welche Firma ist meine" entstanden. Der richtige Weg steht in der
    // Fundmeldung — nicht das Muster aufweichen.
    expect(
      funde.map((f) => `${f.datei}:${f.zeile} — ${f.regel}\n    ${f.text}`),
    ).toEqual([]);
  });
});
