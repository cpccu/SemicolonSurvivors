import { crc32, deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sanitizePng } from "./png";

function png() {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const chunk = (type: string, data: Buffer) => { const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4); const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0); return Buffer.concat([head, data, checksum]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(1, 0); header.writeUInt32BE(1, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.from([0, 20, 30, 40, 255]))), chunk("IEND", Buffer.alloc(0))]);
}
describe("community image boundary", () => {
  it("accepts a bounded RGB/RGBA PNG and rejects other formats", () => {
    expect(sanitizePng(png()).subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(() => sanitizePng(Buffer.from("not an image"))).toThrow();
  });
});
