// Runs in the browser before upload: shrinks the photo to at most 2000 px on the long side and
// re-encodes it as JPEG. This keeps uploads small (Vercel's limit is about 4.5 MB), turns iPhone
// HEIC photos into JPEG (Safari can decode them), and removes metadata such as GPS location.
// The server re-encodes again, so this is a convenience, not the security boundary.

const MAX_SIDE = 2000;

export async function prepareImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo format can't be opened here. Please choose a JPEG or PNG photo.");
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Your browser couldn't prepare the photo. Please try another browser.");
  return blob;
}
