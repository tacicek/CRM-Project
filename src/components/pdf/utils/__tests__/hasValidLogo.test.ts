import { describe, expect, it } from "vitest";
import { hasValidLogo } from "../hasValidLogo";

describe("hasValidLogo — entscheidet, ob der Kopf ein Logo oder den Firmennamen zeigt", () => {
  it.each([
    "data:image/png;base64,iVBORw0KGgo=",
    "https://example.test/logo.svg",
    "http://example.test/logo.png",
  ])("akzeptiert eine ladbare Quelle: %s", (logo) => {
    expect(hasValidLogo(logo)).toBe(true);
  });

  it.each([undefined, null, "", "   ", "logo.png", "null", "/uploads/logo.png", "ftp://host/logo.png"])(
    "verwirft %s — sonst rendert <Image> nichts und der Kopf nennt die Firma gar nicht",
    (logo) => {
      expect(hasValidLogo(logo)).toBe(false);
    },
  );
});
