// Leçons en anglais (#167) : même leçon qu'en français, étape par étape. Seuls les textes changent.
import { CHAPITRES_EN, LESSONS_EN } from '../../content/lessons.en.js';
import { CHAPITRES, LESSONS, LESSONS_FR, localiser, TRADUCTIONS, type Lesson } from './lessons';
import { mots } from './demo';

const EN = TRADUCTIONS.en.lecons;
const traduites = LESSONS_FR.filter(l => l.id in EN);

/** Une leçon sans ses textes : ce qui fait la leçon (positions, réponses, démonstrations, gestes, réfutations). */
function squelette(l: Lesson): unknown {
  const retirer = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(retirer);
    if (!v || typeof v !== 'object') return v;
    return Object.fromEntries(Object.entries(v).filter(([k]) => !['text', 'ok', 'no', 'choices', 'title', 'desc'].includes(k)).map(([k, x]) => [k, retirer(x)]));
  };
  return retirer(l);
}

/** Tous les textes affichés d'une leçon. */
function textes(l: Lesson): string[] {
  return [l.title, l.desc, ...l.steps.flatMap(s => [
    s.text,
    ...('ok' in s ? [s.ok, s.no] : []),
    ...(s.kind === 'quiz' ? s.choices : []),
    ...(s.kind === 'info' && s.geste && 'no' in s.geste && s.geste.no ? [s.geste.no] : []),
    ...(s.kind === 'move' && s.refus ? s.refus.map(r => r.no) : []),
  ])];
}

const FRANCAIS = /\b(le|la|les|des|du|une|est|et|pour|avec|sans|ton|ta|tes|tu|toi|je|pas|sur|dans|qui|que|pierres?|noir|blanc|libertés?|coup)\b|[àâçéèêëîïôûùœ]/iu;

describe('leçons en anglais : catalogue (#167)', () => {
  it('au moins les leçons 1 à 3 sont traduites, et chaque traduction vise une leçon existante', () => {
    for (const id of ['l1', 'l2', 'l3']) expect(Object.keys(EN)).toContain(id);
    for (const id of Object.keys(LESSONS_EN)) expect(LESSONS_FR.map(l => l.id)).toContain(id);
    for (const id of Object.keys(CHAPITRES_EN)) expect(CHAPITRES.map(c => c.id)).toContain(id);
  });
  it('dans les tests (sans ?lang), les leçons et les chapitres restent en français', () => {
    expect(LESSONS).toEqual(LESSONS_FR);
    expect(CHAPITRES[0].titre).toBe('Les bases');
  });
  it('une leçon non traduite reste en français en anglais', () => {
    for (const l of LESSONS_FR.filter(x => !(x.id in EN))) expect(localiser(l, 'en')).toBe(l);
  });
});

for (const fr of traduites) describe(`${fr.id} en anglais : ${EN[fr.id].title}`, () => {
  const en = localiser(fr, 'en');
  const tr = EN[fr.id];
  it('même nombre d’étapes, et chaque étape a exactement les textes que le français a', () => {
    expect(tr.steps).toHaveLength(fr.steps.length);
    fr.steps.forEach((s, i) => {
      const e = tr.steps[i];
      expect(e.ok !== undefined, `étape ${i + 1} : ok`).toBe('ok' in s);
      expect(e.no !== undefined, `étape ${i + 1} : no`).toBe('no' in s);
      expect(e.choices?.length, `étape ${i + 1} : choix`).toBe(s.kind === 'quiz' ? s.choices.length : undefined);
      expect(e.geste !== undefined, `étape ${i + 1} : aide du geste`).toBe(s.kind === 'info' && !!s.geste && 'no' in s.geste && !!s.geste.no);
      expect(e.refus?.length, `étape ${i + 1} : réfutations`).toBe(s.kind === 'move' ? s.refus?.length : undefined);
    });
  });
  fr.steps.forEach((s, i) => it(`étape ${i + 1} : positions, réponses et gestes identiques au français`, () => {
    expect(en.steps[i].kind).toBe(s.kind);
    expect(squelette({ ...en, steps: [en.steps[i]] })).toEqual(squelette({ ...fr, steps: [s] }));
  }));
  it('tous les textes changent, aucun n’est vide ni en français', () => {
    const a = textes(en), b = textes(fr);
    expect(a).toHaveLength(b.length);
    a.forEach((x, i) => {
      expect(x.trim(), `texte ${i}`).not.toBe('');
      expect(x, `texte ${i}`).not.toMatch(FRANCAIS);
      // Les choix chiffrés (« 36 ») peuvent rester identiques ; les phrases, jamais.
      if (/\p{L}{3}/u.test(b[i])) expect(x, `texte ${i} : « ${b[i]} »`).not.toBe(b[i]);
    });
  });
  it('chaque consigne tient en 12 mots, comme en français ; l’aide d’un geste aussi', () => {
    en.steps.forEach((s, i) => {
      expect(mots(s.text), `étape ${i + 1} : « ${s.text} »`).toBeLessThanOrEqual(12);
      if (s.kind === 'info' && s.geste && 'no' in s.geste && s.geste.no) expect(mots(s.geste.no)).toBeLessThanOrEqual(12);
    });
  });
  it('les coordonnées citées sont les mêmes qu’en français', () => {
    const coords = (l: Lesson) => textes(l).map(x => (x.match(/\b[A-HJ][1-9]\b/g) ?? []).sort().join(' '));
    expect(coords(en)).toEqual(coords(fr));
  });
  it('vocabulaire du glossaire : jamais « square », « case », « shicho » ; atari et ko en minuscules', () => {
    for (const x of textes(en)) {
      expect(x).not.toMatch(/\b(squares?|case|shicho|Atari!|stone is captured by)\b/);
      expect(x.replace(/^Atari\b/, '').replace(/[.:!?]\s+Atari\b/g, '')).not.toMatch(/\bAtari\b|\bKo\b(?!$)/);
    }
  });
});
