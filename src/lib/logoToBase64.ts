import { supabase } from "@/integrations/supabase/client";

/**
 * Downloads a company logo and returns it as a PNG base64 data URL.
 *
 * Why PNG conversion?
 * - Logos are stored as WebP (see LogoUpload.tsx)
 * - @react-pdf/renderer does NOT support WebP — only PNG/JPEG/GIF
 * - We draw the image onto an HTML canvas and export as PNG
 *
 * Why Supabase Storage download?
 * - Blob URL is same-origin → canvas won't be tainted (no CORS issue)
 * - Works even if the bucket has CORS restrictions
 */
export async function logoToBase64(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;

  let blob: Blob | null = null;

  // 1. Try Supabase Storage client download (bypasses CORS, returns raw Blob)
  const supabaseMatch = url.match(/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?.*)?$/);
  if (supabaseMatch) {
    const [, bucket, path] = supabaseMatch;
    try {
      const { data, error } = await supabase.storage.from(bucket).download(path);
      if (!error && data) blob = data;
    } catch { /* fall through */ }
  }

  // 2. Fallback: plain fetch
  if (!blob) {
    try {
      const res = await fetch(url, { mode: "cors" });
      if (res.ok) blob = await res.blob();
    } catch { /* fall through */ }
  }

  if (!blob) return null;

  // 3. Convert blob → Object URL → draw on canvas → export as PNG
  //    (Canvas with a Blob URL is never tainted, so toDataURL always works)
  return blobToPngBase64(blob);
}

function blobToPngBase64(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 100;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(null); return; }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };

    img.src = objectUrl;
  });
}
