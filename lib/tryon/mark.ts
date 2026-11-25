import "server-only";

import sharp from "sharp";
import { AI_MARK_PNG_BASE64, AI_MARK_SIZE } from "./ai-mark-image";

const LABEL = "AI-generated preview";

/**
 * Puts the visible "AI-generated preview" label in the bottom-left corner and writes the same
 * words into the image metadata (AI roadmap §4.3). Returns a JPEG of at most 2000 px.
 */
export async function markAsAiPreview(input: Buffer): Promise<Buffer> {
  const base = await sharp(input, { limitInputPixels: 60_000_000 })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });
  const { width, height } = base.info;

  const labelWidth = Math.max(140, Math.min(width - 16, Math.round(width * 0.42)));
  const labelHeight = Math.round((labelWidth * AI_MARK_SIZE.height) / AI_MARK_SIZE.width);
  const margin = Math.max(8, Math.round(width * 0.025));
  const label = await sharp(Buffer.from(AI_MARK_PNG_BASE64, "base64")).resize({ width: labelWidth }).toBuffer();

  return sharp(base.data)
    .composite([{ input: label, left: margin, top: Math.max(0, height - labelHeight - margin) }])
    .withExif({ IFD0: { ImageDescription: LABEL, Software: "Virtual try-on (AI-generated)" } })
    .jpeg({ quality: 88, mozjpeg: true })
    .toBuffer();
}
