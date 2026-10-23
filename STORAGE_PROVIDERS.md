# Providers de stockage — authentification et cycle de vie

Ce document décrit le contrat entre `main.ts` (orchestrateur), `StorageManager` et les
`StorageProvider`, en particulier pour l'authentification. Il sert de référence pour
l'ajout de nouveaux providers (Dropbox, pCloud…).

## État actuel

- **Un seul provider actif** : `GoogleDriveProvider` (GIS *token client*, flow en popup).
- **Interface** : `web/src/storage/StorageProvider.ts` — `init()`, `authenticate(): Promise<boolean>`,
  `disconnect()`, `loadData()`, `saveData()`, `getStatus()`, `isReadOnly()`.
- **Sélection** : `StorageManager` instancie le provider par défaut ; `useProvider()`
  permet d'en changer dynamiquement (mode démo).
- **Orchestration** (`main.ts`) : à l'URL `app/?connect`, l'app appelle `store.login()`,
  puis selon le résultat :
  - succès → `history.replaceState` retire `?connect` (pas de rechargement) ;
  - échec → `dashboard.showConnectFailed()` affiche la carte d'erreur, l'utilisateur
    peut réessayer via le bouton de connexion en haut à droite.
- **Échec détecté** : `GoogleDriveProvider.authenticate()` pose un `_pendingAuthError`
  appelé par `error_callback` de GIS — la promesse se résout toujours (pop-up bloquée
  `popup_failed_to_open`, fermée `popup_closed`, erreur OAuth dans `resp.error`).
- **Échec expliqué** : chaque provider classe son erreur native dans un `AuthFailureKind`
  (`storage/AuthFailure.ts`) exposé via `getAuthFailure()` ; le kit
  `authFailureExplanation()` fournit le libellé — les providers ne recodent pas leurs
  messages.

## Typologie des flows d'authentification

Trois familles, aux mécanismes de verdict très différents :

### 1. Popup pilotée en JavaScript (Google GIS actuel)

`authenticate()` ouvre une popup et résout sa promesse via les callbacks de la librairie.
L'échec est un événement JS (`error_callback`). **La promesse doit toujours se résoudre** —
c'était le bug corrigé en 2025-07 : sans branchement de `error_callback`, `store.login()`
restait pendu indéfiniment.

### 2. Redirect pleine page (Dropbox, pCloud en `response_type=code|token`)

`authenticate()` navigue vers `https://provider/oauth2/authorize?...&redirect_uri=<app>`.
**La promesse ne résout jamais : la page quitte.** L'utilisateur revient sur l'app avec les
paramètres de retour dans l'URL (`?code=`, `#access_token=` pour l'implicit, `?error=` en cas
de refus). Le verdict se lit **au boot suivant**.

Implications :
- `?connect` ne survit pas forcément au round-trip — le `state` OAuth ou la présence des
  paramètres de retour (`code`/`error`) suffisent à identifier la reprise ;
- le provider doit exposer une méthode de reprise qui consomme ses paramètres d'URL,
  échange le code si besoin, et retourne le verdict ;
- le nettoyage d'URL (`replaceState`) doit retirer **les paramètres OAuth** en plus de
  `connect` — le provider déclare ceux qui lui appartiennent.

### 3. Popup scrutée (variante pCloud du SDK officiel)

`window.open` + polling de `window.closed` / lecture de `popup.location` une fois revenue
sur l'origine. Échec = fenêtre fermée détectée par polling (pas de `error_callback`).

## Contrat proposé (évolution de `StorageProvider`)

```ts
type AuthOutcome =
  | { status: 'success' }
  | { status: 'cancelled' }            // utilisateur : popup fermée, consentement refusé
  | { status: 'failed'; reason?: string }; // erreur technique ou réseau

// Remplace authenticate(): Promise<boolean>
authenticate(): Promise<AuthOutcome>;

// Nouveau : consomme les paramètres OAuth présents dans l'URL au retour
// d'un redirect. No-op (success nul / 'none') pour les flows popup.
resumeAuth(url: URL): Promise<AuthOutcome | 'none'>;

// Paramètres d'URL que le provider consomme (pour le nettoyage replaceState)
readonly authResponseParams: string[]; // ex. ['code','state','error'] ou hash '#access_token'

// Déjà implémenté : classification de l'échec pour l'UI (AuthFailure.ts)
getAuthFailure(): AuthFailure | null;
```

**Règle d'or** : `login()` doit **toujours** se conclure par un verdict, d'où qu'il vienne
(`error_callback`, polling `window.closed`, paramètres de retour au boot). Jamais de promesse
pendante, jamais d'état « en attente » sans issue.

`main.ts` reste l'orchestrateur neutre : il mappe le verdict vers l'UI
(attente → succès : nettoyage URL ; échec : carte d'erreur). Il ne connaît aucun détail
OAuth.

## Messages d'échec : **pas** communs à tous les providers — kit partagé

Implémenté via `web/src/storage/AuthFailure.ts` :

- le provider classe son erreur native dans un **`AuthFailureKind`**
  (`popupBlocked` / `popupClosed` / `accessDenied` / `error`) et l'expose via
  `StorageProvider.getAuthFailure()` ;
- **`authFailureExplanation(failure)`** rend les paragraphes cause/solution à partir des
  clés `auth.failure.*` — le libellé vit une seule fois, les nouveaux providers n'ont
  qu'à mapper leurs erreurs sur les kinds (et en ajouter si besoin, ex. `redirectDenied`
  pour un `?error=` de retour) ;
- `DashboardView` garde le cadre commun : titre « La connexion a échoué » +
  ligne « réessayer en haut à droite ».

Rappel : avec un redirect il n'y a **pas de pop-up à bloquer**. Les échecs typiques :

| Cause | Manifestation | Détectable ? |
|---|---|---|
| Refus sur la page de consentement | retour `?error=access_denied` | oui, au boot |
| Abandon (onglet fermé chez le provider) | jamais de retour | non — rien à faire |
| Erreur réseau / provider indisponible | retour `?error=` ou `error_description` | oui |
| `state` invalide (protection CSRF) | pas de correspondance avec la tentative | oui — échec de sécurité |

## Comparatif des providers envisagés

| | Google Drive (actuel) | Dropbox | pCloud |
|---|---|---|---|
| Flow canonique | popup GIS | **redirect** OAuth2 (code + PKCE) | popup pollée ou redirect |
| Retour d'erreur | `error_callback` | `?error=` sur l'URL de retour | `window.closed` / `?error=` |
| Échange de code | non (token implicite) | oui, `POST /oauth2/token` (CORS OK) | oui si `response_type=code` |
| Durée du token | ~1 h, re-consent/silent | refresh token longue durée | access token sans expiration |
| Réponse dans | callback JS | query `?` ou hash `#` | hash `#access_token=` |

## Code mort

`PCloudProvider.ts` et `LocalStorageProvider.ts` sont **non référencés** et **jamais testés**
(écrits au tout début du projet). Ils sont marqués `DEAD CODE` en tête de fichier et
conservés uniquement comme esquisses de référence — à **réécrire**, pas à réanimer, lors de
l'ajout des providers correspondants. Suppression propre envisageable.
