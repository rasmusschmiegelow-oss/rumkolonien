// Kopierer spillets filer til www/, som Capacitor pakker ind i iOS-appen.
// Service workeren kommer ikke med: appen har allerede alle filer på telefonen.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const OUT = 'www';
const FILES = ['index.html', 'style.css', 'manifest.webmanifest', 'js', 'assets'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of FILES) cpSync(f, `${OUT}/${f}`, { recursive: true });
console.log(`Kopierede ${FILES.length} dele til ${OUT}/`);
