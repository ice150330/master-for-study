export function createIdempotencyKey(scope: string) {
  return `${scope}:${crypto.randomUUID()}`;
}
