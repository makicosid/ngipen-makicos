export type BoundedFormDataResult =
  | { ok: true; formData: FormData }
  | { ok: false; reason: "too_large" | "invalid" };

/** Reads multipart request bodies with a hard byte ceiling before parsing. */
export async function readFormDataWithinLimit(
  request: Request,
  maxBytes: number
): Promise<BoundedFormDataResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !request.body) {
    return { ok: false, reason: "invalid" };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return { ok: false, reason: "invalid" };
    }
    if (parsedLength > maxBytes) return { ok: false, reason: "too_large" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  try {
    const body = Buffer.concat(chunks, total);
    const formData = await new Response(body, {
      headers: { "content-type": contentType },
    }).formData();
    return { ok: true, formData };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}


export type BoundedJsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; reason: "too_large" | "invalid" };

/** Reads and validates a small JSON object without buffering an unbounded body. */
export async function readJsonObjectWithinLimit(
  request: Request,
  maxBytes = 16 * 1024
): Promise<BoundedJsonResult> {
  const contentType = request.headers.get("content-type") || "";
  if (!/^application\/json(?:\s*;|$)/i.test(contentType) || !request.body) {
    return { ok: false, reason: "invalid" };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
      return { ok: false, reason: "invalid" };
    }
    if (parsedLength > maxBytes) return { ok: false, reason: "too_large" };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "invalid" };
  }

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks, total).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, reason: "invalid" };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}
