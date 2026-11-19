import { describe, expect, it } from "vitest";
import { readRequestBody, readSmallJsonObject } from "@/lib/request-body";

function streamingRequest(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Request("http://localhost/upload", {
    method: "POST",
    body,
    headers,
    duplex: "half",
  } as RequestInit);
}

describe("readRequestBody", () => {
  it("returns the full body when it is within the limit", async () => {
    const request = streamingRequest([new Uint8Array([1, 2]), new Uint8Array([3])]);
    const body = await readRequestBody(request, 10);
    expect(body).toEqual(Buffer.from([1, 2, 3]));
  });

  it("stops reading once the body passes the limit", async () => {
    const request = streamingRequest([new Uint8Array(6), new Uint8Array(6)]);
    expect(await readRequestBody(request, 10)).toBeNull();
  });

  it("enforces the limit even when Content-Length understates the size", async () => {
    const request = streamingRequest([new Uint8Array(64)], { "content-length": "1" });
    expect(await readRequestBody(request, 10)).toBeNull();
  });

  it("returns an empty buffer when there is no body", async () => {
    const request = new Request("http://localhost/upload", { method: "POST" });
    expect(await readRequestBody(request, 10)).toEqual(Buffer.alloc(0));
  });
});

describe("readSmallJsonObject", () => {
  function jsonRequest(text: string) {
    return new Request("http://localhost/api", { method: "POST", body: text });
  }

  it("parses a JSON object", async () => {
    expect(await readSmallJsonObject(jsonRequest('{"userCode":"ABCD-EFGH"}'))).toEqual({
      userCode: "ABCD-EFGH",
    });
  });

  it("treats an empty body as an empty object", async () => {
    expect(await readSmallJsonObject(jsonRequest(""))).toEqual({});
  });

  it.each([
    ["invalid JSON", "{nope"],
    ["an array", "[1,2]"],
    ["null", "null"],
    ["a string", '"hi"'],
  ])("rejects %s", async (_label, text) => {
    expect(await readSmallJsonObject(jsonRequest(text))).toBeNull();
  });

  it("rejects bodies over the size limit", async () => {
    const text = JSON.stringify({ padding: "x".repeat(100) });
    expect(await readSmallJsonObject(jsonRequest(text), 50)).toBeNull();
  });
});
