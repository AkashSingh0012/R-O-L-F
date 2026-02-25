export function serializeBigInt(obj: any): any {
  if (Array.isArray(obj)) return obj.map(serializeBigInt);

  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k in obj) {
      const v = obj[k];
      out[k] =
        typeof v === "bigint"
          ? v.toString()
          : typeof v === "object"
          ? serializeBigInt(v)
          : v;
    }
    return out;
  }

  return obj;
}