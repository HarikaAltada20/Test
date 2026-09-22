declare module "archiver" {
  export type ArchiverOptions = {
    store?: boolean;
    zlib?: { level?: number };
  };

  export class ZipArchive {
    constructor(options?: ArchiverOptions);
    on(event: "error", listener: (error: Error) => void): Archiver;
    pipe<T extends NodeJS.WritableStream>(destination: T): T;
    file(path: string, data: { name: string }): Archiver;
    append(source: string | Buffer, data: { name: string }): Archiver;
    finalize(): Promise<void>;
  }

  export type Archiver = ZipArchive;
}
