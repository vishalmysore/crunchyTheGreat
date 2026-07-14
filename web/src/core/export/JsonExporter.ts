import { CompressedContext } from '../model/CompressedContext.js';

/** Serializes the CIR to deterministic, pretty-printed JSON. */
export function toJson(context: CompressedContext): string {
  return JSON.stringify(context, null, 2);
}
