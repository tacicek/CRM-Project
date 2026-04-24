import imageCompression from 'browser-image-compression';

interface CompressionOptions {
  maxWidthOrHeight?: number;
  maxSizeMB?: number;
  fileType?: string;
}

/**
 * Converts and compresses an image to WebP format.
 * @param file The original image file
 * @param options Custom compression options
 * @returns A promise that resolves to the compressed WebP file
 */
export async function convertToWebP(file: File, options: CompressionOptions = {}): Promise<File> {
  const defaultOptions = {
    maxSizeMB: 0.8, // Max 800KB
    maxWidthOrHeight: 1920, // Max 1920px
    useWebWorker: true,
    fileType: 'image/webp', // Force WebP conversion
    initialQuality: 0.8,
    ...options
  };

  try {
    console.log(`Original file size: ${file.size / 1024 / 1024} MB`);
    const compressedFile = await imageCompression(file, defaultOptions);
    console.log(`Compressed file size: ${compressedFile.size / 1024 / 1024} MB`);
    
    const fileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const webpFile = new File([compressedFile], `${fileName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    });

    return webpFile;
  } catch (error) {
    console.error('Image compression failed, re-throwing:', error);
    throw error;
  }
}

// Supabase Storage client type
interface SupabaseStorageClient {
  storage: {
    from: (bucket: string) => {
      upload: (path: string, file: File, options?: { cacheControl?: string; upsert?: boolean }) => Promise<{ data: { path: string } | null; error: Error | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } };
    };
  };
}

/**
 * Helper to upload image to Supabase storage after conversion
 */
export async function processAndUploadImage(
  file: File, 
  bucket: string, 
  path: string,
  supabase: SupabaseStorageClient
): Promise<{ url: string | null; error: Error | null }> {
  try {
    // 1. Convert to WebP
    const webpFile = await convertToWebP(file);

    // 2. Upload to Supabase
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(`${path}/${Date.now()}-${webpFile.name}`, webpFile, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) throw error;
    if (!data) throw new Error("Upload failed: no data returned");

    // 3. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { url: publicUrl, error: null };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    return { url: null, error: errorObj };
  }
}

