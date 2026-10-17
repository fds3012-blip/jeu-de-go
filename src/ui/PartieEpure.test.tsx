// #602 : épure de l'écran de partie. La pastille des jetons n'apparaît qu'une fois un jeton utilisé ; « prisonniers »
// ne s'écrit sous le couvercle que si on le demande (la toute première partie) ; le ruban des coups n'a plus de titre visible.
import { renderToStaticMarkup } from 'react-dom/server';
import { Bandeau, CompteurIndices, ListeCoups } from './Partie';

describe('épure de la partie (#602)', () => {
  it('pastille des jetons : absente à 3 sur 3, présente dès le premier jeton utilisé', () => {
    expect(renderToStaticMarkup(<CompteurIndices restants={3}><i /></CompteurIndices>)).not.toContain('compteur-badge');
    expect(renderToStaticMarkup(<CompteurIndices restants={2}><i /></CompteurIndices>)).toContain('>2</b>');
    expect(renderToStaticMarkup(<CompteurIndices restants={0}><i /></CompteurIndices>)).toContain('>0</b>');
  });

  it('« prisonniers » sous le couvercle seulement avec `legende`, le nombre toujours lu', () => {
    const b = (legende?: boolean) => renderToStaticMarkup(<Bandeau nom="Toi" sousTitre="Noir" portrait={null} actif={false} captures={2} pierresPrises="blanc" legende={legende} />);
    expect(b()).not.toContain('couvercle-legende');
    expect(b(true)).toContain('couvercle-legende');
    expect(b()).toContain('sr-only');
  });

  it('ruban des coups : nommé pour le lecteur d’écran, sans titre visible', () => {
    const html = renderToStaticMarkup(<ListeCoups coups={['1. E5']} />);
    expect(html).not.toContain('coups-titre');
    expect(html).toContain('aria-label="Coups joués"');
  });
});
