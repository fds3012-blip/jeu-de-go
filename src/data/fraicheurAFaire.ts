// #584 : version de « À faire » (défis, notifications, recherche lente, demandes d'ami). Chaque écriture du joueur qui
// le change l'augmente ; la lecture gardée moins d'une minute (src/app/aFaireCharge.ts, chargé à la demande) est alors
// relue au prochain changement d'écran. Module minuscule : il est dans le JS initial avec src/data/defi.ts.
let version = 0;

/** Une écriture du joueur (ou une notification reçue) vient de changer « À faire » : la prochaine lecture relit. */
export function invaliderAFaire(): void { version++; }

export function versionAFaire(): number { return version; }
