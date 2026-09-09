import { describe, expect, it } from "vitest";

function extractManifestPath(args: string[]): string | null {
  for (const arg of args) {
    const trimmed = arg.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("goc-downloader://")) {
      try {
        const url = new URL(trimmed);
        const path =
          url.searchParams.get("path") ||
          url.searchParams.get("file") ||
          url.pathname.replace(/^\//, "");
        if (path && path.toLowerCase().endsWith(".gocdownload")) {
          return decodeURIComponent(path);
        }
        return null;
      } catch {
        return null;
      }
    }
    if (trimmed.toLowerCase().endsWith(".gocdownload")) {
      return trimmed.replace(/^"+|"+$/g, "");
    }
  }
  return null;
}

describe("deep-link manifest path extraction", () => {
  it("extracts file association paths", () => {
    expect(
      extractManifestPath(['C:\\Users\\me\\Downloads\\job.gocdownload']),
    ).toBe("C:\\Users\\me\\Downloads\\job.gocdownload");
  });

  it("returns null for bare import deep links", () => {
    expect(extractManifestPath(["goc-downloader://import"])).toBeNull();
  });

  it("reads path query params", () => {
    expect(
      extractManifestPath([
        "goc-downloader://import?path=C%3A%5Ctmp%5Cfile.gocdownload",
      ]),
    ).toBe("C:\\tmp\\file.gocdownload");
  });
});
