import { expect, type Page } from '@playwright/test';

// #458 : outils des parcours du lecteur de leçons au zoom 200 % (195 px) et en 320 px.

/**
 * Touche au doigt le bouton d'action du lecteur (« Continuer », « Terminer la leçon »), comme un joueur qui zoome :
 * la page défile tout en bas (le pire cas : avant #458, le bouton y restait sous la barre de navigation), puis le
 * bouton doit être entier à l'écran, au-dessus de la barre du bas, assez haut pour le doigt, et rien ne le recouvre.
 */
export async function toucherAction(page: Page, nom: string, ecran: string) {
  const bouton = page.locator('.lecon-actions').getByRole('button', { name: nom, exact: true });
  await expect(bouton, `${ecran} : « ${nom} » absent`).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const r = await bouton.evaluate((el: HTMLElement) => {
    const b = el.getBoundingClientRect();
    const nav = document.querySelector('.nav')?.getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const dessus = document.elementFromPoint(cx, cy);
    return {
      haut: b.top, bas: b.bottom, hauteur: b.height, navHaut: nav?.top ?? innerHeight, cx, cy,
      libre: !!dessus && (el === dessus || el.contains(dessus)),
      dessus: dessus ? `${dessus.tagName.toLowerCase()}.${String(dessus.className)}` : 'rien (hors écran)',
    };
  });
  expect(r.haut, `${ecran} : « ${nom} » coupé en haut de l'écran`).toBeGreaterThanOrEqual(0);
  expect(r.bas, `${ecran} : « ${nom} » sous la barre du bas`).toBeLessThanOrEqual(r.navHaut + 0.5);
  expect(r.hauteur, `${ecran} : « ${nom} » trop bas pour le doigt`).toBeGreaterThanOrEqual(44);
  expect(r.libre, `${ecran} : « ${nom} » recouvert par ${r.dessus}`).toBe(true);
  await page.touchscreen.tap(r.cx, r.cy);
}

/**
 * La bulle de Mochi passe à la ligne entre les mots : chaque mot tient sur une seule ligne (ses rectangles, via
 * Range.getClientRects, sont sur la même ligne) et reste dans la bulle ; seul un trait d'union peut finir une ligne.
 * Seul un mot plus large que la bulle à lui seul aurait le droit d'être coupé.
 */
export async function motsEntiers(page: Page, ecran: string) {
  const r = await page.locator('.mochi-bulle p').evaluate((p: HTMLElement) => {
    // Boîte de contenu de la bulle (padding déduit) : un paragraphe élargi par un mot trop long ne masque pas le débord.
    const bulle = p.closest('.mochi-bulle')!, st = getComputedStyle(bulle), b = bulle.getBoundingClientRect();
    const boite = { left: b.left + parseFloat(st.paddingLeft), right: b.right - parseFloat(st.paddingRight), width: 0 };
    boite.width = boite.right - boite.left;
    const coupes: string[] = [], dehors: string[] = [];
    const parcours = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    for (let n = parcours.nextNode(); n; n = parcours.nextNode()) {
      const texte = n.textContent ?? '';
      // Un trait d'union est une coupure permise (« colle-/toi ») : chaque partie compte comme un mot.
      for (const m of texte.matchAll(/[^\s-]+-?|-/g)) {
        const range = document.createRange();
        range.setStart(n, m.index!);
        range.setEnd(n, m.index! + m[0].length);
        const rects = [...range.getClientRects()].filter(x => x.width > 0.5);
        const lignes = new Set(rects.map(x => Math.round(x.top)));
        const largeur = rects.reduce((s, x) => s + x.width, 0);
        if (lignes.size > 1 && largeur <= boite.width + 0.5) coupes.push(m[0]);
        if (rects.some(x => x.left < boite.left - 0.5 || x.right > boite.right + 0.5)) dehors.push(m[0]);
      }
    }
    return { coupes, dehors, texte: p.textContent };
  });
  expect(r.coupes, `${ecran} : mots coupés dans la bulle « ${r.texte} »`).toEqual([]);
  expect(r.dehors, `${ecran} : mots qui sortent de la bulle « ${r.texte} »`).toEqual([]);
}
