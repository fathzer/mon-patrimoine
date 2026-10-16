import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fr } from '../i18n/fr.js';

function* tsFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      yield* tsFiles(path);
    } else if (path.endsWith('.ts')) {
      yield path;
    }
  }
}

function resolveKey(key: string): unknown {
  let node: unknown = fr;
  for (const part of key.split('.')) {
    node = (node as Record<string, unknown> | null)?.[part];
  }
  return node;
}

describe('I18n keys', () => {
  it('every static key passed to I18n.t in the sources resolves in the fr dictionary', () => {
    const srcDir = join(import.meta.dir, '..');
    const missing: string[] = [];
    for (const file of tsFiles(srcDir)) {
      const content = readFileSync(file, 'utf8');
      for (const match of content.matchAll(/I18n\.t\(\s*['"]([^'"]+)['"]/g)) {
        const key = match[1];
        if (typeof resolveKey(key) !== 'string') {
          missing.push(`${key} (${file.replace(srcDir, 'src')})`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
