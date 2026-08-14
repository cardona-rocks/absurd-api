/**
 * Convierte un nombre en un slug: minúsculas, sin acentos y con guiones.
 *
 * Es el mismo criterio que usa el panel al sugerir el slug de un avatar nuevo,
 * para que un avatar creado a mano y otro migrado acaben igual.
 */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    // Quita los diacríticos que la descomposición NFD deja sueltos.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Slug libre a partir de un nombre, añadiendo un sufijo si ya está cogido.
 *
 * `taken` se actualiza sobre la marcha para que valga también dentro de un
 * mismo lote, no solo contra lo que ya hay en la base de datos.
 */
export function uniqueSlug(
  name: string,
  taken: Set<string>,
  fallback = 'avatar',
): string {
  const base = slugify(name) || fallback;
  let candidate = base;
  let n = 2;
  while (taken.has(candidate)) {
    // Se recorta la base para que el sufijo quepa en el límite de 40.
    const suffix = `-${n}`;
    candidate = base.slice(0, 40 - suffix.length) + suffix;
    n++;
  }
  taken.add(candidate);
  return candidate;
}
