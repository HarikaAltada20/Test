/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 * Produces a deterministic UTF-8 JSON string for Ed25519 signing.
 * Must stay compatible with Rust `serde_jcs`.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]"
  );
}

/** Escape a string per JSON + JCS (no unnecessary escapes). */
function canonicalizeString(value: string): string {
  let out = '"';
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    switch (c) {
      case 0x22: // "
        out += '\\"';
        break;
      case 0x5c: // \
        out += "\\\\";
        break;
      case 0x08:
        out += "\\b";
        break;
      case 0x0c:
        out += "\\f";
        break;
      case 0x0a:
        out += "\\n";
        break;
      case 0x0d:
        out += "\\r";
        break;
      case 0x09:
        out += "\\t";
        break;
      default:
        if (c < 0x20) {
          out += `\\u${c.toString(16).padStart(4, "0")}`;
        } else {
          out += value[i];
        }
    }
  }
  return `${out}"`;
}

/**
 * Canonicalize a JSON value (JCS). Numbers must already be finite JSON numbers;
 * BigInt is not supported.
 */
export function canonicalize(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return canonicalizeString(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("JCS does not allow non-finite numbers");
    }
    // ES Number.toString is compatible with JCS for finite numbers used here.
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const parts: string[] = [];
    for (const key of keys) {
      const v = value[key];
      if (v === undefined) continue;
      parts.push(`${canonicalizeString(key)}:${canonicalize(v)}`);
    }
    return `{${parts.join(",")}}`;
  }
  throw new Error(`Unsupported JCS value type: ${typeof value}`);
}

/** Alias matching plan naming (same as canonicalize). */
export function canonicalizeJson(value: unknown): string {
  return canonicalize(value);
}

export function canonicalizeJsonBytes(value: unknown): Buffer {
  return Buffer.from(canonicalize(value), "utf8");
}
