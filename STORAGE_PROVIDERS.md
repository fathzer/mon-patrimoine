# Providers de stockage — authentification et cycle de vie

Ce document décrit le contrat entre `main.ts` (orchestrateur), `StorageManager` et les
`StorageProvider`, en particulier pour l'authentification. Il sert de référence pour
l'ajout de nouveaux providers (Dropbox, pCloud…).

## État actuel

- **Deux providers actifs** : `DropboxProvider` (redirect OAuth2 code + PKCE,
  `token_access_type=offline`) et `GoogleDriveProvider` (GIS *token client*, flow en popup).
- **Interface** : `web/src/storage/StorageProvider.ts` — `init()`, `authenticate(): Promise<boolean>`,
  `disconnect()`, `loadData()`, `saveData()`, `getStatus()`, `isReadOnly()`,
  `resumeAuth(url)` et `authResponseParams` (voir « reprise après redirect » plus bas).
- **Sélection** : `StorageManager` instancie les providers par nom (`useProviderByName`) ;
  le dernier provider de compte utilisé est mémorisé (`localStorage mp_provider`) pour la
  restauration de session, avec repli sur tout autre provider ayant une session stockée ;
  `useProvider()` sert pour les providers éphémères (mode démo).
- **Choix utilisateur** : à l'URL `app/?connect`, `DashboardView.showProviderPicker()`
  affiche la mini-carte de sélection (un bouton par provider configuré — un seul provider
  configuré démarre directement sans picker). Le bouton de connexion de la top bar mène au
  même picker.
- **Orchestration** (`main.ts`) :
  - retour d'un redirect OAuth → `storageManager.resumeAuth(url)` consomme les paramètres,
    nettoie l'URL (`authResponseParams` + `connect` en cas de succès — `connect=<nom>`
    est conservé après un échec, un rechargement retente alors le même provider),
    puis `store.init()` charge les données ; verdict négatif → `dashboard.showConnectFailed()` ;
  - `?connect` → le picker ; `?connect=<nom>` (ex. `dropbox`) → deep link qui lance
    directement l'auth du provider nommé. La sélection remonte au handler
    `dashboard.onProviderPick` qui lance `store.login()` puis : succès →
    `history.replaceState` retire `?connect` ; échec → carte d'erreur avec réessai
    via le bouton de connexion en haut à droite.
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

Implémenté pour Dropbox :

- `authenticate()` génère le `state` anti-CSRF et le couple PKCE
  (`code_verifier`/`code_challenge` S256), les stocke en `sessionStorage` avec l'URI de
  redirection exacte (`<origin><pathname>?connect=dropbox`, construite dynamiquement —
  chaque origine doit être enregistrée telle quelle dans la console Dropbox), puis
  navigue via `location.assign` et retourne une promesse intentionnellement pendante.
  Le `connect=dropbox` sert de triple rôle : il rend la query string form-urlencoded
  (un `?connect` nu est **rejeté** par Dropbox), il identifie le provider propriétaire
  des paramètres de retour, et `app/?connect=<nom>` fonctionne comme *deep link* lançant
  directement l'auth du provider nommé, sans passer par la mini-carte de sélection ;
- `StorageManager.authenticate()` marque le provider en attente
  (`sessionStorage mp_pending_provider`) quand `authResponseParams` est non vide — au
  boot suivant, `resumeAuth` route l'URL vers ce provider, avec repli sur la valeur de
  `connect` présente dans l'URL de retour ;
- `DropboxProvider.resumeAuth()` valide le `state`, échange le code
  (`POST /oauth2/token`, `code_verifier`, sans secret — client public PKCE) et stocke
  l'access token (≈4 h) et le refresh token (longue durée) en `localStorage` ;
- `token_access_type=offline` dans l'URL d'autorisation est ce qui fait délivrer le
  refresh token ;
- le nettoyage d'URL (`replaceState`) retire `code`, `state`, `error`,
  `error_description` (déclarés dans `authResponseParams`) en plus de `connect` ;
- fichier de données : pas d'équivalent aux `appProperties` de Drive — le fichier est
  adressé par son **identifiant Dropbox** (la valeur `id` renvoyée par l'API, préfixée
  `id:`, est utilisable directement comme `path` dans `files/download` / `files/upload`),
  qui survit au renommage ; repli sur le nom `/patrimoine_data.json` puis re-découverte
  de l'id à chaque réponse API ;
- restauration : `init()` retourne vrai dès qu'un refresh token est stocké ; l'access
  token expiré est rafraîchi paresseusement au premier appel API — pas de re-consentement
  périodique comme chez Google ;
- `disconnect()` révoque le token (`/auth/token/revoke`, qui invalide aussi le refresh
  token associé) puis efface le stockage local.

### 3. Popup scrutée (variante pCloud du SDK officiel)

`window.open` + polling de `window.closed` / lecture de `popup.location` une fois revenue
sur l'origine. Échec = fenêtre fermée détectée par polling (pas de `error_callback`).

## Contrat implémenté (évolution de `StorageProvider`)

```ts
// Inchangé : true = authentifié. Pour un provider redirect, la promesse ne
// résout jamais (la page quitte) — le verdict arrive par resumeAuth().
authenticate(): Promise<boolean>;

// Consomme les paramètres OAuth présents dans l'URL au retour d'un redirect.
// 'none' = l'URL ne porte rien pour ce provider ; no-op pour les flows popup.
resumeAuth(url: URL): Promise<boolean | 'none'>;

// Paramètres d'URL que le provider consomme (pour le nettoyage replaceState)
readonly authResponseParams: string[]; // ex. ['code','state','error','error_description']

// Classification de l'échec pour l'UI (AuthFailure.ts)
getAuthFailure(): AuthFailure | null;
```

Le verdict détaillé `AuthOutcome` (success/cancelled/failed + reason) proposé
initialement n'est pas retenu pour l'instant : le couple `boolean` + `getAuthFailure()`
couvre les besoins actuels. À reconsidérer si un provider a besoin de distinguer plus
finement « annulé » de « en échec ».

**Règle d'or** : `login()` doit **toujours** se conclure par un verdict, d'où qu'il vienne
(`error_callback`, polling `window.closed`, paramètres de retour au boot). Jamais de promesse
pendante, jamais d'état « en attente » sans issue — pour les flows redirect, la promesse
d'`authenticate()` reste pendante *par construction* et le verdict est produit par
`resumeAuth()` au boot suivant.

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
| Abandon — onglet fermé chez le provider | jamais de retour | non — rien à faire |
| Abandon — bouton retour du navigateur | restauration de la page `?connect` depuis le bfcache, figée dans l'état quitté | la carte « en attente » n'est affichée que pour les flows popup — un redirect quitte en laissant la carte de sélection, donc le retour arrière la restaure telle quelle (détectable via `pageshow`/`persisted` si besoin, inutile ici) |
| Erreur réseau / provider indisponible | retour `?error=` ou `error_description` | oui |
| `state` invalide (protection CSRF) | pas de correspondance avec la tentative | oui — échec de sécurité |

## Comparatif des providers envisagés

| | Dropbox | Google Drive | pCloud (non implémenté) |
|---|---|---|---|
| Flow canonique | **redirect** OAuth2 (code + PKCE) | popup GIS | popup pollée ou redirect |
| Retour d'erreur | `?error=` sur l'URL de retour | `error_callback` | `window.closed` / `?error=` |
| Échange de code | oui, `POST /oauth2/token` (CORS OK) | non (token implicite) | oui si `response_type=code` |
| Durée du token | refresh token longue durée | ~1 h, re-consent/silent | access token sans expiration |
| Réponse dans | query `?` | callback JS | hash `#access_token=` |

## Code mort

`PCloudProvider.ts` et `LocalStorageProvider.ts` sont **non référencés** et **jamais testés**
(écrits au tout début du projet). Ils sont marqués `DEAD CODE` en tête de fichier et
conservés uniquement comme esquisses de référence — à **réécrire**, pas à réanimer, lors de
l'ajout des providers correspondants. Suppression propre envisageable.
