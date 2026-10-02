// Plateau serré (#400) : à partir du 13 × 13, les lignes d'un téléphone de 320 px ne sont qu'à 20 px l'une de l'autre.
// Les problèmes y imposent alors la confirmation au doigt et la visée (src/ui/Visee.tsx). Le 9 × 9 n'est pas concerné.

/** Taille à partir de laquelle un plateau est « serré » sur un téléphone. */
export const TAILLE_SERREE = 13;
export const estSerre = (size: number): boolean => size >= TAILLE_SERREE;
