export type ByteRange =
  | { kind: "none" }
  | { kind: "satisfiable"; header: string }
  | { kind: "unsatisfiable" };

const SINGLE_RANGE = /^bytes=(\d*)-(\d*)$/;

/**
 * Interprets an HTTP `Range` header against a file of `size` bytes.
 *
 * - No header, or one this server does not support (several ranges, other
 *   units, bad syntax), is treated as "none": per RFC 9110 the server may
 *   ignore it and send the whole file with 200.
 * - A valid single range that starts past the end of the file is
 *   "unsatisfiable" and should get 416 Range Not Satisfiable.
 * - Otherwise the normalized header is safe to forward to S3.
 */
export function parseByteRange(header: string | null, size: number): ByteRange {
  if (!header) return { kind: "none" };

  const match = SINGLE_RANGE.exec(header.trim());
  if (!match) return { kind: "none" };

  const [, startText, endText] = match;
  if (!startText && !endText) return { kind: "none" };

  // Suffix range: "bytes=-500" means the last 500 bytes.
  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength)) return { kind: "none" };
    if (suffixLength === 0 || size === 0) return { kind: "unsatisfiable" };
    return { kind: "satisfiable", header: `bytes=-${suffixLength}` };
  }

  const start = Number(startText);
  const end = endText ? Number(endText) : null;
  if (!Number.isSafeInteger(start) || (end !== null && !Number.isSafeInteger(end))) {
    return { kind: "none" };
  }
  if (end !== null && end < start) return { kind: "none" };
  if (start >= size) return { kind: "unsatisfiable" };

  return {
    kind: "satisfiable",
    header: end === null ? `bytes=${start}-` : `bytes=${start}-${end}`,
  };
}
