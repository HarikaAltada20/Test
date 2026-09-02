import { createWriteStream } from "fs";
import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { inflateRawSync } from "zlib";
import { ZipArchive } from "archiver";

export const FAILED_DOWNLOADS_REPORT_NAME = "failed_downloads_report.txt";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

export type ZipEntry = {
  name: string;
  data: Buffer;
};

export async function buildZipFile(
  zipPath: string,
  files: { path: string; name: string }[],
  failedReport: string | null,
): Promise<void> {
  const output = createWriteStream(zipPath);
  const archive = new ZipArchive({ store: true });

  await new Promise<void>((resolve, reject) => {
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    for (const file of files) {
      archive.file(file.path, { name: file.name });
    }
    if (failedReport) {
      archive.append(failedReport, { name: FAILED_DOWNLOADS_REPORT_NAME });
    }
    void archive.finalize();
  });
}

export function extractStoredZipEntries(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i++) {
    if (offset + 46 > buffer.length) {
      throw new Error("ZIP central directory overruns buffer");
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Invalid ZIP central directory header");
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + nameLength)
      .toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (name.endsWith("/")) continue;
    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER) {
      throw new Error("Invalid ZIP local file header");
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) {
      throw new Error("ZIP entry data overruns buffer");
    }
    const compressed = buffer.subarray(dataStart, dataEnd);
    let data: Buffer;
    if (method === 0) {
      data = Buffer.from(compressed);
    } else if (method === 8) {
      data = inflateRawSync(compressed);
    } else {
      throw new Error(`Unsupported ZIP compression method ${method}`);
    }
    if (name) entries.push({ name, data });
  }

  return entries;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const recordSize = 22;
  const maxComment = 65535;
  const start = Math.max(0, buffer.length - recordSize - maxComment);
  for (let i = buffer.length - recordSize; i >= start; i--) {
    if (buffer.readUInt32LE(i) !== END_OF_CENTRAL_DIRECTORY) continue;
    const commentLength = buffer.readUInt16LE(i + 20);
    if (i + recordSize + commentLength === buffer.length) return i;
  }
  throw new Error("ZIP end of central directory not found");
}

function combineFailedReports(reports: string[]): string | null {
  const parts = reports.map((value) => value.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join("\n\n") : null;
}

/**
 * Merge two STORE/DEFLATE ZIPs into one archive. Later entries win on name
 * collision. Failed-download reports are concatenated.
 */
export async function mergeVideoDownloadZips(options: {
  existingZipPath: string;
  newZipPath: string;
  outputZipPath: string;
  tempDir: string;
}): Promise<void> {
  const [existingBuffer, newBuffer] = await Promise.all([
    readFile(options.existingZipPath),
    readFile(options.newZipPath),
  ]);
  const existingEntries = extractStoredZipEntries(existingBuffer);
  const newEntries = extractStoredZipEntries(newBuffer);

  const reports: string[] = [];
  const byName = new Map<string, Buffer>();
  for (const entry of [...existingEntries, ...newEntries]) {
    if (entry.name === FAILED_DOWNLOADS_REPORT_NAME) {
      reports.push(entry.data.toString("utf8"));
      continue;
    }
    byName.set(entry.name, entry.data);
  }

  const extractDir = join(options.tempDir, "merge-entries");
  await mkdir(extractDir, { recursive: true });
  const files: { path: string; name: string }[] = [];
  let index = 0;
  for (const [name, data] of byName) {
    index += 1;
    const path = join(extractDir, `entry-${index}`);
    await writeFile(path, data);
    files.push({ path, name });
  }

  await buildZipFile(
    options.outputZipPath,
    files,
    combineFailedReports(reports),
  );
}
