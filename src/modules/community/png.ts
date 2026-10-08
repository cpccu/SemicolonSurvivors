import { crc32, inflateSync } from "node:zlib";

export const maximumImageBytes = 3 * 1024 * 1024;
const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
export function sanitizePng(input: Uint8Array): Buffer {
  const bytes = Buffer.from(input);
  if (bytes.length < 45 || bytes.length > maximumImageBytes || !bytes.subarray(0, 8).equals(signature)) throw new Error("Use a PNG image up to 3 MiB.");
  const output: Buffer[] = [signature];
  const compressed: Buffer[] = [];
  let offset = 8, width = 0, height = 0, channels = 0, ended = false, idatEnded = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length || ended) throw new Error("Invalid PNG structure.");
    const size = bytes.readUInt32BE(offset);
    if (size > maximumImageBytes || offset + size + 12 > bytes.length) throw new Error("Invalid PNG chunk.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    const chunk = bytes.subarray(offset, offset + 12 + size);
    if (!/^[A-Za-z]{4}$/.test(type) || crc32(bytes.subarray(offset + 4, offset + 8 + size)) !== bytes.readUInt32BE(offset + 8 + size)) throw new Error("Invalid PNG checksum.");
    if (offset === 8 && type !== "IHDR") throw new Error("Missing image header.");
    if (type === "IHDR") {
      if (offset !== 8 || size !== 13) throw new Error("Invalid image header.");
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      channels = data[9] === 2 ? 3 : data[9] === 6 ? 4 : 0;
      if (width < 1 || height < 1 || width > 2048 || height > 2048 || !channels || data[8] !== 8 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error("Use a non-interlaced 8-bit RGB/RGBA PNG up to 2048 × 2048.");
      output.push(chunk);
    } else if (type === "IDAT") {
      if (idatEnded) throw new Error("Invalid image data order.");
      compressed.push(data); output.push(chunk);
    } else if (type === "IEND") {
      if (size || !compressed.length) throw new Error("Missing image data.");
      ended = true; output.push(chunk);
    } else {
      if (compressed.length) idatEnded = true;
      if (type[0] === type[0]?.toUpperCase() && type !== "PLTE") throw new Error("Unsupported PNG chunk.");
      // Retain only image data: EXIF, text, location, embedded profiles, and animation metadata are removed.
    }
    offset += size + 12;
  }
  if (!ended) throw new Error("Incomplete PNG image.");
  const stride = width * channels + 1;
  const raw = inflateSync(Buffer.concat(compressed), { maxOutputLength: stride * height });
  if (raw.length !== stride * height) throw new Error("Invalid image dimensions.");
  for (let row = 0; row < height; row += 1) if (raw[row * stride]! > 4) throw new Error("Invalid PNG filter.");
  return Buffer.concat(output);
}
