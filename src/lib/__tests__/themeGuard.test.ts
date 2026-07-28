import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findFixedForegroundOnInvertingBackground } from "@/lib/themeGuard";

describe("findFixedForegroundOnInvertingBackground", () => {
  it("flags a fixed foreground on an inverting background", () => {
    const hits = findFixedForegroundOnInvertingBackground(
      '<Button className="bg-folk-ink text-white hover:bg-folk-ink2" />',
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].line).toBe(1);
    expect(hits[0].backgrounds).toContain("folk-ink");
  });

  it("accepts the palette's own counter-colour", () => {
    expect(
      findFixedForegroundOnInvertingBackground('<Button className="bg-folk-ink text-folk-bg" />'),
    ).toEqual([]);
  });

  it("leaves saturated accents alone — they keep their hue in both themes", () => {
    expect(
      findFixedForegroundOnInvertingBackground('<span className="bg-folk-coral text-white" />'),
    ).toEqual([]);
  });

  it("reports the correct line in a multi-line source", () => {
    const source = ["const a = 1;", "", '<div className="bg-folk-card text-black" />'].join("\n");
    expect(findFixedForegroundOnInvertingBackground(source)[0].line).toBe(3);
  });
});

/** Alle .tsx unterhalb von src einsammeln. */
const collectTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return collectTsx(path);
    return path.endsWith(".tsx") ? [path] : [];
  });

describe("the source tree", () => {
  it("never pairs a fixed foreground with an inverting background", () => {
    const offenders = collectTsx("src").flatMap((path) => {
      const hits = findFixedForegroundOnInvertingBackground(readFileSync(path, "utf-8"));
      return hits.map((hit) => `${path}:${hit.line} (${hit.backgrounds.join(", ")})`);
    });

    // Schlaegt das hier fehl: text-white/text-black durch text-folk-bg ersetzen.
    // Diese Paarung liest sich hell mit 17:1 und dunkel mit 1.2:1 — im Hellen
    // entwickelt bemerkt man es nie.
    expect(offenders).toEqual([]);
  });
});
