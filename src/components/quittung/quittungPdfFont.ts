import { Font } from "@react-pdf/renderer";
import regular from "@/assets/fonts/DejaVuSans.ttf";
import bold from "@/assets/fonts/DejaVuSans-Bold.ttf";

// Bundled assets: creating a receipt never depends on an external font host.
// Unicode names and addresses remain unchanged in every document language.
export const RECEIPT_PDF_FONT = "ReceiptDejaVuSans";

Font.register({
  family: RECEIPT_PDF_FONT,
  fonts: [
    { src: regular, fontWeight: 400 },
    { src: bold, fontWeight: 700 },
  ],
});
