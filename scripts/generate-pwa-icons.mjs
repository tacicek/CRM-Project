/**
 * Erzeugt die Icons für das Web-App-Manifest aus dem vorhandenen Logo.
 *
 * Warum ein Skript und keine einmalig abgelegten Dateien: ändert sich das
 * Logo, sind die drei Grössen sonst still veraltet. Ein Lauf reicht.
 *
 *   node scripts/generate-pwa-icons.mjs
 *
 * Zur maskierbaren Fassung: Android schneidet das Icon in eine beliebige Form
 * (Kreis, Squircle, Tropfen). Sicher ist nur der innere Kreis mit 80 % des
 * Durchmessers. Das Logo wird deshalb auf 60 % skaliert und auf eine volle
 * Fläche gesetzt — sonst beschneidet das System die Ränder des Motivs.
 */
import { existsSync } from "node:fs";
import sharp from "sharp";

const SOURCE = "public/favicon.png";
const BACKGROUND = "#FBFAF7"; // entspricht --folk-bg im Hellmodus

if (!existsSync(SOURCE)) {
  console.error(`generate-pwa-icons: ${SOURCE} fehlt.`);
  process.exit(1);
}

const run = async () => {
  const meta = await sharp(SOURCE).metadata();
  console.log(`Quelle: ${SOURCE} (${meta.width}×${meta.height}, ${meta.format})`);

  // Normale Icons: das Motiv fuellt die Flaeche.
  for (const size of [192, 512]) {
    const out = `public/pwa-${size}.png`;
    await sharp(SOURCE).resize(size, size, { fit: "cover" }).png().toFile(out);
    console.log(`  ${out}`);
  }

  // Maskierbar: Motiv auf 60 % im sicheren Bereich, Rest gefuellt.
  const size = 512;
  const inner = Math.round(size * 0.6);
  const motiv = await sharp(SOURCE).resize(inner, inner, { fit: "cover" }).png().toBuffer();
  const out = `public/pwa-maskable-512.png`;
  await sharp({
    create: { width: size, height: size, channels: 4, background: BACKGROUND },
  })
    .composite([{ input: motiv, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`  ${out} (Motiv ${inner}px im sicheren Bereich)`);
};

run().catch((error) => {
  console.error("generate-pwa-icons fehlgeschlagen:", error.message);
  process.exit(1);
});
