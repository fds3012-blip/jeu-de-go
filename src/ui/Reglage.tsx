// Lignes compactes du Profil (issue #50) : interrupteur, choix segmenté et lien, 48 px de haut.
import type { ReactNode } from 'react';

/** Ligne entière tactile avec un interrupteur à droite (`role="switch"`). */
export function LigneInterrupteur({ libelle, aide, actif, onChange }: { libelle: string; aide?: string; actif: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={actif} className="ligne" onClick={() => onChange(!actif)}>
      <span className="ligne-texte">
        <span className="ligne-libelle">{libelle}</span>
        {aide && <span className="ligne-aide">{aide}</span>}
      </span>
      <span className="interrupteur" aria-hidden="true"><span /></span>
    </button>
  );
}

/** Ligne avec un choix segmenté à droite. */
export function LigneChoix<T extends string>({ libelle, options, valeur, onChange }: {
  libelle: string; options: readonly { valeur: T; libelle: string }[]; valeur: T; onChange: (v: T) => void;
}) {
  return (
    <div className="ligne ligne-choix" role="group" aria-label={libelle}>
      <span className="ligne-libelle" aria-hidden="true">{libelle}</span>
      <span className="seg">
        {options.map(o => <button type="button" key={o.valeur} aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)}>{o.libelle}</button>)}
      </span>
    </div>
  );
}

/** Ligne qui ouvre une sous-vue : libellé, valeur éventuelle, chevron. */
export function LigneLien({ libelle, valeur, onClick }: { libelle: string; valeur?: ReactNode; onClick: () => void }) {
  return (
    <button type="button" className="ligne" onClick={onClick}>
      <span className="ligne-libelle">{libelle}</span>
      {valeur && <span className="ligne-valeur">{valeur}</span>}
      <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
    </button>
  );
}
