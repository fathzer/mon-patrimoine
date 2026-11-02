# Migration de `mon-patrimoine` vers l'organisation GitHub `yapbam`

> **Objectif** : déplacer `fathzer/mon-patrimoine` vers `yapbam/mon-patrimoine` en préservant
> l'historique complet (commits, tags, releases, issues), en gardant l'application fonctionnelle
> (PWA + OAuth Google Drive / Dropbox / OneDrive), et en affichant sur l'ancienne URL
> `fathzer.github.io/mon-patrimoine` une page « nous avons déménagé » avec la marche à suivre.

Nouvelle adresse cible : **https://yapbam.github.io/mon-patrimoine/**

## Décisions actées

| Sujet | Décision |
|---|---|
| Méthode de migration | **Transfer ownership** GitHub natif — préserve commits, tags (v1.0.0 → v1.3.0), releases, l'issue ouverte, branches distantes (`main`, `1.3-branch`) et crée des redirections web/git. **Exception : GitHub Pages n'est PAS redirigé** → l'ancienne URL passe en 404 le temps de la phase 2. |
| `ts-cloud-storage-manager` | Reste sous `fathzer` — dépendance `github:fathzer/ts-cloud-storage-manager#v0.0.1-preview` inchangée. |
| Gists (INSEE + démo) | Restent sous `fathzer` (un gist ne peut pas appartenir à une org) — **aucun changement d'URL** dans le code. Seul le secret `GIST_TOKEN` est à recréer sur le repo yapbam. |
| Ancien site | Repo **minimal** recréé `fathzer/mon-patrimoine` servant la page de déménagement (bouton, pas d'auto-redirect). ⚠️ Recréer ce nom casse la redirection `github.com/fathzer/mon-patrimoine` → yapbam — accepté. |
| Pré-annonce | Pas de bannière préventive — la page de déménagement suffit. |
| App Google OAuth | En mode **Test** : toutes les modifs du consent screen sont libres (pas de vérification en cours à préserver). |

## Inventaire des points sensibles

- **OAuth** : `GOOGLE_CLIENT_ID`, `DROPBOX_APP_KEY`, `ONEDRIVE_CLIENT_ID` en dur dans `web/src/main.ts` — identifiants **inchangés** (mêmes applications OAuth), seules les consoles doivent autoriser la nouvelle origine.
- **Sessions** : localStorage/IndexedDB sont liés à l'origine → tous les utilisateurs devront **se reconnecter**. Les données sont retrouvées côté cloud via le même `patrimoine_data.json`.
- **Service worker** : stratégie network-first en prod → la page de déménagement sera propagée vite, y compris pour les PWA installées (`/mon-patrimoine/app/` est l'`start_url`). Un `sw.js` auto-désinscrivant + un script de nettoyage ciblé complètent le ménage.
- **⚠️ Nettoyage ciblé** : localStorage et Cache Storage sont partagés par **toute l'origine `fathzer.github.io`** (d'autres apps y vivent peut-être). Ne supprimer que : clés `mon-patrimoine.*` et `patrimoine_ui_v1` (localStorage), caches `app-cache-*`, registrations SW dont le scope contient `/mon-patrimoine/`. Jamais `localStorage.clear()`.
- **Références `fathzer` à mettre à jour** : `web/index.html` (liens GitHub ×2), `web/src/ui/HelpModalView.ts` (liens repo/issues ×2 — le lien gist l.~152 reste), `README.md` (badges, URL live, DeepWiki).
- **Références `fathzer` qui restent** : `web/src/core/inflation.ts` et `web/src/core/AppStore.ts` (URLs gist), `scripts/fetch_insee_cpi.py` (gist API), `STORAGE_PROVIDERS.md` (lib fathzer), `web/package.json` (dépendance lib).
- **Branches locales non poussées** (`better-history`, `better-variations`, `demo-data`, anciennes `v1.x`) : restent dans le clone local — le transfert n'affecte pas le disque. À pousser avant le transfert seulement si on veut les voir côté GitHub.

---

## Phase 0 — Préparation (avant le transfert, non cassant)

### 0.1 — Google Cloud Console

L'origine JavaScript `https://yapbam.github.io` doit être autorisée sur le client OAuth
`1075597097575-9q8l4dvvahrpqn4l7dvu1999i0259ct8.apps.googleusercontent.com`.

1. **Essayer d'abord l'ajout direct** : Console → APIs et services → Identifiants → client OAuth
   → *Origines JavaScript autorisées* → ajouter `https://yapbam.github.io` (garder `https://fathzer.github.io`).
2. **Si la console refuse** (*« Invalid Origin: domain must be added to the authorized domains list »*) — `yapbam.github.io` doit être un *Authorized domain* du consent screen, ce qui exige une vérification Search Console du domaine. Deux variantes :

   **Variante A (recommandée — Drive fonctionnel dès le jour J)** : pré-vérifier via un repo placeholder.

   ```bash
   # Dans Google Search Console : créer la propriété URL-prefix
   #   https://yapbam.github.io/mon-patrimoine/
   # et récupérer la meta google-site-verification (token donné immédiatement).

   # Créer le placeholder localement
   mkdir -p ~/yapbam-placeholder && cd ~/yapbam-placeholder
   git init -b main
   cat > index.html <<'EOF'
   <!DOCTYPE html><html><head>
   <meta name="google-site-verification" content="TOKEN_SEARCH_CONSOLE_ICI" />
   <title>yapbam</title></head><body>Verification page.</body></html>
   EOF
   touch .nojekyll
   git add -A && git commit -m "Placeholder for Search Console verification"
   gh repo create yapbam/mon-patrimoine --public --source=. --push
   gh api repos/yapbam/mon-patrimoine/pages -X POST -f build_type=legacy \
     -f "source[branch]=main" -f "source[path]=/"
   ```

   Attendre que `https://yapbam.github.io/mon-patrimoine/` serve la page, puis dans Search Console
   cliquer **Verify** sur la propriété. Ensuite : Google Auth Platform → Branding → *Authorized domains*
   → ajouter `yapbam.github.io` → retourner à l'étape 1 (ajout de l'origine JS).

   > La même meta de vérification devra aussi figurer dans `web/index.html` (voir phase 3) pour
   > conserver la propriété Search Console active.

   **Variante B (plus simple, Drive indisponible un moment sur la nouvelle URL)** : faire toute la
   chaîne Search Console → authorized domain → origine JS **après** le déploiement du nouveau site
   (la meta est alors ajoutée à `web/index.html` dans le commit d'URLs, phase 3).
   Dropbox et OneDrive ne sont pas affectés par ce délai.

3. **Branding** (optionnel, libre en mode Test) : mettre à jour homepage/privacy/tos vers les URLs
   `yapbam.github.io/mon-patrimoine/` — sinon les copies servies sur l'ancien site suffisent.

### 0.2 — Dropbox Console

<https://www.dropbox.com/developers/console/apps> → app `zvz86dayzn4qkt8` → onglet **Settings** →
*Redirect URIs* : ajouter `https://yapbam.github.io/mon-patrimoine/app/?connect=dropbox`
(garder l'ancienne `https://fathzer.github.io/mon-patrimoine/app/?connect=dropbox`).

### 0.3 — Microsoft Entra

<https://entra.microsoft.com> → *App registrations* → app `59ee9063-c01a-49c7-b23e-a175d153b85e`
→ **Authentication** → plateforme *Single-page application* → ajouter la redirect URI
`https://yapbam.github.io/mon-patrimoine/app/` (garder l'ancienne).

### 0.4 — Préparer le commit d'URLs (branche `migration-yapbam`)

```bash
cd ~/git/mon-patrimoine
git checkout -b migration-yapbam
```

Modifications :

| Fichier | Changement |
|---|---|
| `web/index.html` | `https://github.com/fathzer/mon-patrimoine` → `https://github.com/yapbam/mon-patrimoine` (×2 : tableau comparatif + footer) ; remplacer la meta `google-site-verification` par le token de la propriété yapbam (si authorized domain exigé — sinon laisser tel quel). |
| `web/src/ui/HelpModalView.ts` | `https://github.com/fathzer/mon-patrimoine/issues` → `.../yapbam/...` ; `github.com/fathzer/mon-patrimoine` → `github.com/yapbam/mon-patrimoine`. |
| `README.md` | Badge `deploy.yml` (img + lien) `fathzer` → `yapbam` ; URL live `fathzer.github.io` → `yapbam.github.io` (×2) ; badge DeepWiki `deepwiki.com/fathzer/mon-patrimoine` → `deepwiki.com/yapbam/mon-patrimoine`. |

```bash
git add -A
git commit -m "Update URLs for the yapbam organization"
git push -u origin migration-yapbam   # restera à merger après le transfert
```

### 0.5 — Préparer le site de déménagement (repo local prêt à pousser)

```bash
mkdir -p ~/mon-patrimoine-moved && cd ~/mon-patrimoine-moved
git init -b main
mkdir -p app
cp ~/git/mon-patrimoine/web/favicon.svg .
cp ~/git/mon-patrimoine/web/privacy.html ~/git/mon-patrimoine/web/terms.html .
cp -r ~/git/mon-patrimoine/web/css .   # référencé par privacy.html/terms.html
touch .nojekyll
```

Créer les fichiers suivants (contenu exact fourni en annexe A) :

- `index.html`, `app/index.html`, `404.html` — page « déménagé » (même contenu, chemins absolus
  `/mon-patrimoine/...` pour fonctionner à toute profondeur d'URL) ;
- `moved.css` — styles ;
- `cleanup.js` — désinscription ciblée SW + caches + clés de l'app ;
- `sw.js` — service worker auto-désinscrivant (retire l'ancien SW des navigateurs/PWA) ;
- `manifest.json` — manifest minimal pointant sur `/mon-patrimoine/app/` ;
- `README.md` — lien vers `yapbam/mon-patrimoine`.

```bash
git add -A && git commit -m "Site de déménagement vers yapbam.github.io/mon-patrimoine"
# NE PAS pousser : le nom fathzer/mon-patrimoine n'est libre qu'après le transfert.
```

---

## Phase 1 — Transfert du dépôt

1. Si la variante A a été jouée : `gh repo delete yapbam/mon-patrimoine --yes`
   (le nom doit être libre pour le transfert — libération immédiate ; le placeholder n'est plus utile,
   la propriété Search Console et l'authorized domain, eux, persistent).
2. Transférer : repo `fathzer/mon-patrimoine` → **Settings → General → Danger Zone → Transfer
   ownership** → owner `yapbam`. Ou en CLI :
   ```bash
   gh api repos/fathzer/mon-patrimoine/transfer -X POST -f new_owner=yapbam
   ```
3. ⚠️ Dès cet instant, `fathzer.github.io/mon-patrimoine` renvoie 404 (Pages non redirigées) —
   enchaîner immédiatement les phases 2 et 3.
4. Mettre à jour le clone local :
   ```bash
   cd ~/git/mon-patrimoine && git remote set-url origin https://github.com/yapbam/mon-patrimoine.git
   ```
5. Vérifier Settings → **Pages** du repo yapbam : source « GitHub Actions » (normalement conservée ;
   sinon `gh api repos/yapbam/mon-patrimoine/pages -X POST -f build_type=workflow`).
6. Recréer le secret `GIST_TOKEN` : Settings → Secrets and variables → Actions → `GIST_TOKEN`
   = PAT classique du compte fathzer avec scope `gist` (les secrets ne survivent pas toujours au
   transfert — vérifier). Astuce : le token `gh` courant a déjà le scope `gist` →
   `gh secret set GIST_TOKEN -R yapbam/mon-patrimoine --body "$(gh auth token)"` (moins durable
   qu'un PAT dédié si la session gh est révoquée).

---

## Phase 2 — Page « déménagé » sur l'ancienne URL (prioritaire : fenêtre 404)

```bash
cd ~/mon-patrimoine-moved
git remote add origin https://github.com/fathzer/mon-patrimoine.git
gh repo create fathzer/mon-patrimoine --public
git push -u origin main
gh api repos/fathzer/mon-patrimoine/pages -X POST -f build_type=legacy \
  -f "source[branch]=main" -f "source[path]=/"
```

→ `https://fathzer.github.io/mon-patrimoine/` affiche la page de déménagement
(propagation Pages : quelques minutes).

---

## Phase 3 — Nouveau site en service

1. Merger la branche préparée en phase 0.4 (PR ou merge local + push) → `deploy.yml` s'exécute et
   publie sur `https://yapbam.github.io/mon-patrimoine/`.
2. **Tests de fumée** sur la nouvelle URL :
   - [ ] Landing + `/app/` chargent, pas d'erreur console ;
   - [ ] Mode démo fonctionne (données via gist fathzer — inchangé) ;
   - [ ] Connexion **Dropbox** (redirect flow) — fichier `patrimoine_data.json` retrouvé ;
   - [ ] Connexion **OneDrive** (redirect flow) ;
   - [ ] Connexion **Google Drive** (popup, origine JS) — nécessite la phase 0.1 complète ;
   - [ ] Affichage euros constants (séries INSEE via gist) ;
   - [ ] Installation PWA depuis la nouvelle URL.
3. Si variante B Google : chaîne Search Console (`https://yapbam.github.io/mon-patrimoine/` avec la
   meta livrée dans le commit d'URLs) → authorized domain `yapbam.github.io` → origine JS.
4. Valider le workflow INSEE :
   ```bash
   gh workflow run fetch-insee-cpi.yml -R yapbam/mon-patrimoine
   gh run list -R yapbam/mon-patrimoine --workflow fetch-insee-cpi.yml
   ```
5. Vérifier sur l'ancienne URL (navigateur + PWA installée le cas échéant) : la page déménagement
   s'affiche, le SW est désinscrit (`Application → Service Workers` vide sous DevTools, caches
   `app-cache-*` supprimés).

---

## Risques et notes

- **Fenêtre 404** sur l'ancienne URL entre le transfert et la phase 2 : quelques minutes,
  incompressible (le repo `fathzer/mon-patrimoine` doit être libéré puis recréé).
- **Synchro offline** : d'éventuelles modifications en attente dans la file IndexedDB de l'ancienne
  origine ne sont pas transférables — mentionné dans la page de déménagement (cas marginal : le
  SyncEngine pousse dès qu'il est en ligne).
- **Google Drive** : maillon le plus lent si l'authorized domain est exigé — la variante A
  (placeholder) l'élimine ; en variante B, Drive est indisponible sur la nouvelle URL le temps de la
  chaîne Search Console (Dropbox/OneDrive OK immédiats).
- **Google en mode Test** : seuls les test users déclarés peuvent connecter Google Drive — état
  actuel inchangé. Une remise en production re-heurtera le mur de vérification des domaines
  `github.io` (une piste long terme serait un domaine custom — hors scope de cette migration).
- **`google-site-verification`** : la meta actuelle est propre à `fathzer.github.io` — la garder
  dans le site de déménagement (propriété Search Console existante) et mettre le nouveau token
  dans le nouveau site.
- **Bug pré-existant (non corrigé ici)** : `privacy.html`/`terms.html` référencent `src/legal.js`
  qui renvoie 404 en production (le déploiement publie `legal.js` à la racine). Cosmétique — le
  contenu des pages est statique ; les copies du site de déménagement reproduisent le même état.
- **DeepWiki** : le badge pointera vers `deepwiki.com/yapbam/mon-patrimoine` ; la réindexation peut
  nécessiter une nouvelle soumission sur deepwiki.com.
- **Rollback** : en cas d'échec, le transfert est rejouable dans l'autre sens (admin yapbam →
  fathzer) après suppression du repo stub — aucune donnée perdue, seulement de la dispo.

---

## Annexe A — Fichiers du site de déménagement

### `index.html` (identique pour `app/index.html` et `404.html`)

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex">
    <meta name="theme-color" content="#0b0f17">
    <meta name="google-site-verification" content="gOJNJY-vylnSrDLOgy_FFUxGSGusxz_6lhqAaLkszj8" />
    <title>Mon Patrimoine a déménagé</title>
    <link rel="icon" type="image/svg+xml" href="/mon-patrimoine/favicon.svg" />
    <link rel="manifest" href="/mon-patrimoine/manifest.json">
    <link rel="stylesheet" href="/mon-patrimoine/moved.css">
</head>
<body>
    <main class="moved-card">
        <h1><img src="/mon-patrimoine/favicon.svg" alt="" class="logo">Mon Patrimoine a déménagé</h1>
        <p class="lead">L'application est désormais hébergée à l'adresse :</p>
        <p><a class="btn" href="https://yapbam.github.io/mon-patrimoine/">https://yapbam.github.io/mon-patrimoine/</a></p>

        <h2>Marche à suivre</h2>
        <ol>
            <li><strong>Vos données n'ont pas bougé</strong> : votre fichier
                <code>patrimoine_data.json</code> est dans votre espace Cloud (Dropbox, OneDrive ou
                Google Drive). Connectez-vous sur la nouvelle adresse avec <em>le même compte et le
                même fournisseur</em> — l'application le retrouvera automatiquement.</li>
            <li><strong>Application installée (PWA)</strong> : l'installation existante pointe vers
                l'ancienne adresse. Désinstallez-la, ouvrez la nouvelle adresse, puis installez
                l'application depuis celle-ci.</li>
            <li><strong>À savoir</strong> : vos préférences d'affichage (filtres, tris…) sont
                réinitialisées ; d'éventuelles saisies faites hors ligne et non encore synchronisées
                au moment du déménagement ne sont pas transférables.</li>
        </ol>
        <p class="muted">Le code source vit maintenant dans l'organisation
            <a href="https://github.com/yapbam/mon-patrimoine">yapbam/mon-patrimoine</a>.</p>
    </main>
    <script src="/mon-patrimoine/cleanup.js" defer></script>
</body>
</html>
```

> Note : la meta `google-site-verification` conserve la propriété Search Console de
> `fathzer.github.io` (le site de déménagement continue de servir `privacy.html`/`terms.html`,
> référencées par le consent screen Google).

### `cleanup.js`

```js
// Retires the old app's service worker, caches and storage keys — scoped to
// this app only: the fathzer.github.io origin is shared and must not be wiped.
(async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        regs.filter((r) => r.scope.includes('/mon-patrimoine/')).map((r) => r.unregister())
      );
    }
    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('app-cache-')).map((n) => caches.delete(n)));
    }
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k === 'patrimoine_ui_v1' || (k && k.startsWith('mon-patrimoine.'))) doomed.push(k);
    }
    doomed.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Best-effort cleanup only.
  }
})();
```

### `sw.js` (service worker auto-désinscrivant)

```js
// Replacement service worker: exists only to retire the old app's worker.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('app-cache-')).map((n) => caches.delete(n)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
```

### `manifest.json`

```json
{
  "name": "Mon Patrimoine",
  "short_name": "Mon Patrimoine",
  "start_url": "/mon-patrimoine/app/",
  "scope": "/mon-patrimoine/",
  "display": "standalone",
  "background_color": "#0b0f17",
  "theme_color": "#0b0f17",
  "icons": [{ "src": "/mon-patrimoine/favicon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

### `moved.css`

```css
body {
  margin: 0;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #0b0f17;
  color: #e6e9ef;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  padding: 1rem;
}
.moved-card { max-width: 40rem; }
.logo { width: 2.2rem; vertical-align: middle; margin-right: 0.5rem; }
h1 { font-size: 1.6rem; }
h2 { font-size: 1.1rem; margin-top: 1.8rem; }
.lead { margin-bottom: 0.5rem; }
.btn {
  display: inline-block;
  padding: 0.7rem 1.4rem;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  text-decoration: none;
  font-weight: 600;
}
.btn:hover { background: #2563eb; }
li { margin: 0.6rem 0; line-height: 1.5; }
code { background: #1e2635; padding: 0.1rem 0.35rem; border-radius: 4px; }
a { color: #7db3ff; }
.muted { color: #9aa3b2; font-size: 0.9rem; }
```

### `README.md`

```markdown
# mon-patrimoine a déménagé

Le projet vit désormais dans l'organisation [yapbam](https://github.com/yapbam/mon-patrimoine),
et l'application est servie sur https://yapbam.github.io/mon-patrimoine/.

Ce dépôt ne contient que la page « nous avons déménagé » servie par GitHub Pages sur
l'ancienne adresse (fathzer.github.io/mon-patrimoine).
```
