// './scoring' gibi uzantısız içe aktarmaları .ts'ye çözer (Node'un yerleşik test koşucusu için).
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, next) {
  if(specifier==='cloudflare:workers')return next(new URL('./mock-workers.mjs',import.meta.url).href,context);
  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(url))) return next(url.href, context);
  }
  return next(specifier, context);
}
