export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing source-derived UI element #${id}`);
  return found as T;
}

export function text(id: string, value: string) { el(id).textContent = value; }
export function visible(id: string, value: boolean) { el(id).hidden = !value; }
