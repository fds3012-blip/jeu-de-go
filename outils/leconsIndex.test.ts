// Index léger des leçons (#16) : src/content/leconsIndex.gen.ts suit content/lessons.fr.js, et l'accueil voit les mêmes
// leçons et chapitres (titres, nombre d'étapes, ordre), en français et en anglais, qu'avec le contenu complet.
import { readFileSync, writeFileSync } from 'node:fs';
import { CHAPITRES as CHAPITRES_SOURCE, LESSONS as LECONS_SOURCE } from '../content/lessons.fr.js';
import { genererIndexLecons } from './leconsIndex';
import { CHAPITRES, LESSONS, localiser, LESSONS_FR, TRADUCTIONS } from '../src/content/lessons';
import { chapitresResumes, leconsResumees } from '../src/content/leconsResume';

const FICHIER = new URL('../src/content/leconsIndex.gen.ts', import.meta.url);

describe('index léger des leçons (#16)', () => {
  it('src/content/leconsIndex.gen.ts est à jour (sinon : npm run index-lecons)', () => {
    const attendu = genererIndexLecons(LECONS_SOURCE, CHAPITRES_SOURCE);
    if (process.env.MAJ_INDEX_LECONS === '1') writeFileSync(FICHIER, attendu);
    expect(readFileSync(FICHIER, 'utf8'), 'src/content/leconsIndex.gen.ts est en retard : lance `npm run index-lecons`').toBe(attendu);
  });
});

// En mise à jour (`npm run index-lecons`), le module importé est encore l'ancien : comparaison au prochain lancement.
describe.skipIf(process.env.MAJ_INDEX_LECONS === '1')('index léger des leçons (#16) : accueil inchangé', () => {
  it('en français : mêmes leçons (id, titre, description, nombre d’étapes) et mêmes chapitres que le contenu complet', () => {
    const resume = leconsResumees('fr');
    expect(resume.map(l => [l.id, l.title, l.desc, l.steps.length])).toEqual(LESSONS_FR.map(l => [l.id, l.title, l.desc, l.steps.length]));
    const complets = CHAPITRES_SOURCE.map(c => ({ ...c, complet: c.complet !== false }));
    expect(chapitresResumes('fr', resume).map(c => ({ ...c, lecons: c.lecons.map(l => l.id) })))
      .toEqual(complets.map(c => ({ id: c.id, titre: c.titre, intro: c.intro, ...(c.fin ? { fin: c.fin } : {}), complet: c.complet, lecons: c.lecons })));
  });
  it('en anglais : mêmes titres que les leçons traduites, mêmes chapitres traduits', () => {
    const resume = leconsResumees('en');
    expect(resume.map(l => [l.id, l.title, l.desc, l.steps.length])).toEqual(LESSONS_FR.map(l => localiser(l, 'en')).map(l => [l.id, l.title, l.desc, l.steps.length]));
    for (const c of chapitresResumes('en', resume)) expect(c.titre).toBe(TRADUCTIONS.en.chapitres[c.id]?.titre ?? c.titre);
  });
  it('les leçons et chapitres de l’app (langue des tests) sont ceux de l’index', () => {
    expect(leconsResumees('fr').map(l => l.id)).toEqual(LESSONS.map(l => l.id));
    expect(chapitresResumes('fr', leconsResumees('fr')).map(c => c.lecons.map(l => l.id))).toEqual(CHAPITRES.map(c => c.lecons.map(l => l.id)));
  });
});
