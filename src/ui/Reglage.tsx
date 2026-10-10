// Lignes compactes du Profil (issue #50) : interrupteur, choix segmenté et lien, 48 px de haut.
// #103 : chaque ligne peut porter une icône à gauche (IconesReglages.tsx), dans une pastille.
import type { ReactNode } from 'react';

/** Pastille d'icône à gauche d'une ligne. Décorative. */
export function LigneIcone({ children }: { children: ReactNode }) {
  return <span className="ligne-icone" aria-hidden="true">{children}</span>;
}

/** Ligne entière tactile avec un interrupteur à droite (`role="switch"`). */
export function LigneInterrupteur({ libelle, aide, actif, onChange, icone }: { libelle: string; aide?: string; actif: boolean; onChange: (v: boolean) => void; icone?: ReactNode }) {
  return (
    <button type="button" role="switch" aria-checked={actif} className="ligne" onClick={() => onChange(!actif)}>
      {icone && <LigneIcone>{icone}</LigneIcone>}
      <span className="ligne-texte">
        <span className="ligne-libelle">{libelle}</span>
        {aide && <span className="ligne-aide">{aide}</span>}
      </span>
      <span className="interrupteur" aria-hidden="true"><span /></span>
    </button>
  );
}

/** Ligne avec un choix segmenté à droite. */
export function LigneChoix<T extends string>({ libelle, options, valeur, onChange, icone }: {
  libelle: string; options: readonly { valeur: T; libelle: string }[]; valeur: T; onChange: (v: T) => void; icone?: ReactNode;
}) {
  return (
    <div className="ligne ligne-choix" role="group" aria-label={libelle}>
      {icone && <LigneIcone>{icone}</LigneIcone>}
      <span className="ligne-libelle" aria-hidden="true">{libelle}</span>
      <span className="seg">
        {options.map(o => <button type="button" key={o.valeur} aria-pressed={valeur === o.valeur} onClick={() => onChange(o.valeur)}>{o.libelle}</button>)}
      </span>
    </div>
  );
}

/** Ligne qui ouvre une sous-vue : libellé, valeur éventuelle, chevron. */
export function LigneLien({ libelle, valeur, onClick, icone }: { libelle: string; valeur?: ReactNode; onClick: () => void; icone?: ReactNode }) {
  return (
    <button type="button" className="ligne" onClick={onClick}>
      {icone && <LigneIcone>{icone}</LigneIcone>}
      <span className="ligne-libelle">{libelle}</span>
      {valeur && <span className="ligne-valeur">{valeur}</span>}
      <svg className="chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M6 3.5 10.5 8 6 12.5" /></svg>
    </button>
  );
}
