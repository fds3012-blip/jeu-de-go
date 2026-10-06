// Records personnels de cote (issue #369) dans « Ta cote » (Profil) : meilleure cote atteinte après une partie classée,
// avec sa date, et plus longue série de victoires classées (avec la série en cours). Calculés par le serveur
// (`mes_records`, supabase/migrations/20261005230100_emulation_amis.sql) : le record ne descend jamais.
import { useEffect, useState } from 'react';
import { mesRecords, type Records as LesRecords } from '../data/emulation';
import type { Db } from '../data/supabase';
import { te } from '../content/i18n/emulation';
import { grade } from '../content/i18n/cote';
import { langue } from '../content/i18n';
import { useOnline } from '../app/hooks';
import './emulation.css';

/** « 12/10 » (fr) ou « 12/10 » (en-GB), à partir d'une date AAAA-MM-JJ. */
function dateCourte(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(langue() === 'en' ? 'en-GB' : 'fr-FR', { day: '2-digit', month: '2-digit' });
}

export function Records({ db }: { db: Db }) {
  const online = useOnline();
  const [etat, setEtat] = useState<{ etat: 'chargement' } | { etat: 'erreur' } | { etat: 'pret'; records: LesRecords }>({ etat: 'chargement' });
  const [cle, setCle] = useState(0);
  useEffect(() => {
    if (!online) return;
    let vivant = true;
    void mesRecords(db).then(r => { if (vivant) setEtat(r.ok ? { etat: 'pret', records: r.value } : { etat: 'erreur' }); });
    return () => { vivant = false; };
  }, [db, online, cle]);

  let corps;
  if (etat.etat === 'pret' && etat.records.meilleureCote !== null) {
    const r = etat.records;
    corps = (
      <dl>
        <div className="records-ligne" data-testid="record-cote">
          <dt>{te('records.cote')}</dt>
          <dd>{r.meilleureCote} · {grade(r.meilleureCote!)}{r.meilleureCoteLe && <small>{te('records.coteLe', { date: dateCourte(r.meilleureCoteLe) })}</small>}</dd>
        </div>
        <div className="records-ligne" data-testid="record-serie">
          <dt>{te('records.serie')}</dt>
          <dd>{te('records.serieValeur', { n: r.serieVictoires })}{r.serieEnCours > 0 && r.serieEnCours < r.serieVictoires && <small>{te('records.enCours', { n: r.serieEnCours })}</small>}</dd>
        </div>
      </dl>
    );
  } else if (etat.etat === 'pret') corps = <p className="muted small">{te('records.vide')}</p>;
  else if (!online) return null; // hors ligne : la carte de la cote le dit déjà
  else if (etat.etat === 'erreur') {
    corps = <p className="muted small" role="status">{te('records.erreur')} <button type="button" className="lien" onClick={() => { setEtat({ etat: 'chargement' }); setCle(c => c + 1); }}>{te('jour.reessayer')}</button></p>;
  } else corps = <p className="muted small" aria-busy="true">{te('records.chargement')}</p>;

  return (
    <section className="records" aria-labelledby="records-titre" data-testid="records">
      <h3 id="records-titre">{te('records.titre')}</h3>
      {corps}
    </section>
  );
}
