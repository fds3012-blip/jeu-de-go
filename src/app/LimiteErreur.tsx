/**
 * Limite d'erreur React (robustesse, #325 point 4). Deux usages :
 * - autour de l'écran courant dans App.tsx (`origine="ecran"`) : la barre de navigation reste, « Retour à l'accueil »
 *   change d'onglet sans recharger ;
 * - autour de toute l'app dans main.tsx (`origine="global"`) : filet de sécurité, « Retour à l'accueil » recharge `/`.
 *
 * Chaque erreur est signalée à Sentry (avec accord du joueur, src/data/analytics.ts) avec sa catégorie
 * (`chargement`, `reseau`, `rendu`) et son origine, sans donnée personnelle (message nettoyé par `beforeSend`).
 *
 * « Réessayer » : un écran chargé à la demande qui a échoué reste en échec dans React.lazy ; seule une nouvelle page
 * repart propre. On recharge donc (le service worker sert l'app depuis son cache même hors ligne : l'accueil revient).
 */
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { captureError } from '../data/analytics';
import { EcranErreur } from '../ui/EcranErreur';
import { categoriserErreur, messageSur, type CategorieErreur } from './robustesse';

interface Props {
  children: ReactNode;
  origine: 'ecran' | 'global';
  /** Retour à l'accueil sans recharger (App.tsx) ; absent : on recharge `/`. */
  onAccueil?: () => void;
}

interface Etat {
  categorie: CategorieErreur | null;
}

function horsLigne(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export class LimiteErreur extends Component<Props, Etat> {
  state: Etat = { categorie: null };

  static getDerivedStateFromError(err: unknown): Etat {
    return { categorie: categoriserErreur(err, horsLigne()) };
  }

  componentDidCatch(err: unknown, info: ErrorInfo): void {
    const categorie = categoriserErreur(err, horsLigne());
    console.warn(`[${this.props.origine}] ${categorie} : ${messageSur(err) || 'erreur sans message'}`, info.componentStack ?? '');
    captureError(err, { categorie, origine: this.props.origine });
  }

  /** Réinitialise la limite (après un changement d'écran demandé par le parent). */
  reinitialiser = (): void => {
    this.setState({ categorie: null });
  };

  reessayer = (): void => {
    location.reload();
  };

  accueil = (): void => {
    if (this.props.onAccueil) {
      this.props.onAccueil();
      this.reinitialiser();
    } else {
      location.assign('/');
    }
  };

  render(): ReactNode {
    if (this.state.categorie === null) return this.props.children;
    return <EcranErreur categorie={this.state.categorie} horsLigne={horsLigne()} onReessayer={this.reessayer} onAccueil={this.accueil} />;
  }
}
