/**
 * Client-side image compression using the Canvas API.
 *
 * - Images are scaled down so neither dimension exceeds `maxDim` (default 1920 px).
 * - Output is always JPEG at the given `quality` (default 0.82).
 * - Video files and non-image files are returned unchanged.
 * - HEIC/HEIF files are handled via `createImageBitmap` which modern mobile
 *   browsers support natively; if the browser cannot decode the format the
 *   original file is returned as-is.
 *
 * Typical reduction: a 4 MB phone JPEG → 350–700 KB.
 */

const MAX_DIM_DEFAULT = 1920;
const QUALITY_DEFAULT = 0.82;

/**
 * Compress a single image File.
 * Returns a new File (JPEG) or the original file if compression is not
 * applicable / not possible.
 */
export async function compressImage(
  file: File,
  maxDim: number = MAX_DIM_DEFAULT,
  quality: number = QUALITY_DEFAULT
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Browser cannot decode this format (e.g. HEIC on some older browsers)
    return file;
  }

  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }

  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  return new Promise<File>((resolve) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          resolve(file);
          return;
        }
        // Keep the original base name but force .jpg extension
        const baseName = file.name.replace(/\.[^.]+$/, "");
        const compressed = new File([blob], `${baseName}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        // Safety: if compression somehow made the file bigger, return original
        resolve(compressed.size < file.size ? compressed : file);
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Compress multiple files. Videos and non-images pass through unchanged.
 */
export async function compressImages(
  files: File[],
  maxDim: number = MAX_DIM_DEFAULT,
  quality: number = QUALITY_DEFAULT
): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f, maxDim, quality)));
}
