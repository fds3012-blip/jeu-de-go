import { useEffect, useRef } from 'react';

/**
 * #646 (A5) : une activité prend tout l'écran et cache celui d'où l'on vient. À son entrée, le focus va à son titre
 * (`tabIndex={-1}`), pour le clavier et le lecteur d'écran ; la sortie le rend à l'écran d'origine (App.tsx, Puzzles.tsx).
 */
export function useTitreFocus<T extends HTMLElement = HTMLHeadingElement>() {
  const titre = useRef<T>(null);
  useEffect(() => { titre.current?.focus({ preventScroll: true }); }, []);
  return titre;
}
