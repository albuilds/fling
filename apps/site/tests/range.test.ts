import { describe, expect, it } from "vitest";
import { parseByteRange } from "@/lib/range";

const SIZE = 1000;

describe("parseByteRange", () => {
  it("returns none when there is no Range header", () => {
    expect(parseByteRange(null, SIZE)).toEqual({ kind: "none" });
  });

  it.each([
    ["bytes=0-99", "bytes=0-99"],
    ["bytes=500-", "bytes=500-"],
    ["bytes=-200", "bytes=-200"],
    ["bytes=900-5000", "bytes=900-5000"],
    [" bytes=0-0 ", "bytes=0-0"],
  ])("forwards the valid range %j", (header, expected) => {
    expect(parseByteRange(header, SIZE)).toEqual({
      kind: "satisfiable",
      header: expected,
    });
  });

  it.each([
    ["a start past the end", "bytes=1000-"],
    ["a start far past the end", "bytes=5000-6000"],
    ["an empty suffix", "bytes=-0"],
  ])("reports %s as unsatisfiable", (_label, header) => {
    expect(parseByteRange(header, SIZE)).toEqual({ kind: "unsatisfiable" });
  });

  it("reports any range on an empty file as unsatisfiable", () => {
    expect(parseByteRange("bytes=0-", 0)).toEqual({ kind: "unsatisfiable" });
    expect(parseByteRange("bytes=-10", 0)).toEqual({ kind: "unsatisfiable" });
  });

  it.each([
    ["multiple ranges", "bytes=0-10,20-30"],
    ["other units", "items=0-10"],
    ["reversed bounds", "bytes=50-10"],
    ["no numbers", "bytes=-"],
    ["garbage", "bytes=abc-def"],
    ["huge numbers", "bytes=99999999999999999999-"],
  ])("ignores %s and serves the whole file", (_label, header) => {
    expect(parseByteRange(header, SIZE)).toEqual({ kind: "none" });
  });
});
