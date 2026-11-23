export function readRouteId(value: string | null): number | null {
  const id = Number(value);
  return value && /^\d+$/.test(value) && Number.isSafeInteger(id) && id > 0 ? id : null;
}
