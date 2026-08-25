import { I18n } from '../core/I18n.js';

export function getWelcomeHtml(): string {
  return `
    <div class="auth-lock-screen">
      <div class="auth-card">
        <div class="auth-card-header">
          <h2>Bienvenue</h2>
        </div>
        <div class="welcome-cards">
          <div class="welcome-card">
            <div class="welcome-card-header">
              <div class="welcome-card-icon">🏦</div>
              <h3 class="welcome-card-title">Centralisez vos données patrimoniales</h3>
            </div>
            <p class="welcome-card-text">Tout au même endroit : comptes courants, investissements, immobilier, etc...</p>
            <p class="welcome-card-text">Obtenez une vue consolidée de vos placements, leur ventilation par catégorie (livrets, assurances vie, immobilier, etc.).</p>
          </div>
          <div class="welcome-card">
            <div class="welcome-card-header">
              <div class="welcome-card-icon">📈</div>
              <h3 class="welcome-card-title">Obtenez gratuitement une vision estimative de la "vraie" valeur de votre patrimoine.</h3>
            </div>
            <p class="welcome-card-text">Les applications comme <a href="https://finary.com/fr" target="_blank" class="help-link">Finary</a>
             vous donnent une vue d'ensemble de vos placements au travers de leur valeur brute.</p>
             <p class="welcome-card-text">Hélas, c'est une vue très approximative de ce que vous possédez réellement car elle néglige les prélèvements sociaux et les impôts.
             Ce que peut vous rapporter la vente d'une même action peut, suivant sa valeur d'acquisition, sa date d'achat, son mode de détention, varier de plus de 30%.</p>
             <p class="welcome-card-text">${I18n.t('app.title')} calcule la valeur nette de vos actifs en estimant les prélèvements sociaux et les impôts<sup>(1)</sup>.</p>
             <p class="auth-comparison-note"><sup>(1)</sup> Nos calculs sont des estimations qui ne prennent pas en compte toute la complexité du système fiscal français. Ils ne remplacent pas un conseil fiscal professionnel.</p>
          </div>
          <div class="welcome-card">
            <div class="welcome-card-header">
              <div class="welcome-card-icon">🔒</div>
              <h3 class="welcome-card-title">Gardez vos données privées ... privées</h3>
            </div>
            <p class="welcome-card-text">A une époque où les fuites de données font la une des journaux, le parti pris de ${I18n.t('app.title')} est <i><b>"Aucune information ne transite sur nos serveurs."</b></i>.
            Tous les calculs sont effectués localement dans votre navigateur.</p>
            <p class="welcome-card-text">Votre patrimoine est stocké dans votre espace de stockage Cloud. Aucun identifiant permettant d'accèder à celui-ci ne transite par nos serveurs.</p>
          </div>
        </div>
        <p class="text-muted" style="margin-bottom: 1.5rem;">Connectez-vous à votre espace de stockage Cloud pour accéder à votre patrimoine.</p>
        <button id="btn-login" class="btn-primary" style="width:100%; padding: 0.8rem;">
          ${I18n.t('auth.loginBtn')}
        </button>
        <div class="welcome-card">
          <div class="welcome-card-header">
            <div class="welcome-card-icon">🚫</div>
            <h3 class="welcome-card-title">Ce que ${I18n.t('app.title')} ne fait pas</h3>
          </div>
          <ul class="welcome-card-list">
            <li>La mise à jour automatique des valeurs de marché, ni des soldes de vos comptes (pas de connexion à vos banques). C'est à vous de saisir et de maintenir les données.</li>
            <li>Le suivi de l'évolution de votre patrimoine. ${I18n.t('app.title')} vous donne la vue instantannée de celui-ci (du passé faisons table rase !).</li>
            <li>La gestion de budget ou le suivi des dépenses. Son objectif unique est de calculer la valeur de votre patrimoine global.</li>
          </ul>
        </div>
        <div class="welcome-card">
          <div class="welcome-card-header">
            <div class="welcome-card-icon">⚖️</div>
            <h3 class="welcome-card-title">Comparaison avec Finary</h3>
          </div>
          <table class="auth-comparison-table">
            <thead>
              <tr><th></th><th>Mon Patrimoine</th><th>Finary</th></tr>
            </thead>
            <tbody>
              <tr><td>Application mobile</td><td>Oui</td><td>Oui</td></tr>
              <tr><td>Connexion aux banques</td><td>Non</td><td>Oui<sup>(1)</sup></td></tr>
              <tr><td>Mise à jour automatique</td><td>Non</td><td>Oui<sup>(2)</sup></td></tr>
              <tr><td>Gestion de budget</td><td>Non</td><td>Payant</td></tr>
              <tr><td>Historiques des valeurs</td><td>Non</td><td>Oui</td></tr>
              <tr><td>Stockage des données</td><td>Votre Cloud personnel</td><td>Serveurs Finary</td></tr>
              <tr><td>Open source</td><td><a href="https://github.com/fathzer/mon-patrimoine" target="_blank" class="help-link">Oui</a></td><td>Non</td></tr>
            </tbody>
          </table>
          <p class="auth-comparison-note"><sup>(1)</sup>La plupart des banques sont supportées. La connexion implique, le plus souvent, le partage de vos identifiants bancaires avec leur partenaire <a href="https://www.powens.com/fr" target="_blank" class="help-link">Powens</a>.</p>
          <p class="auth-comparison-note"><sup>(2)</sup>Payant au delà de deux banques.</p>
        </div>
      </div>
      <div id="auth-modal-root"></div>
    </div>
  `;
}
