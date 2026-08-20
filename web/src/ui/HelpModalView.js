export class HelpModalView {
  constructor(container) {
    this.container = container;
  }

  show() {
    this.container.innerHTML = `
      <div class="modal-overlay">
        <div class="modal-content help-modal-content">
          
          <!-- En-tête -->
          <h2 class="help-modal-header">
            ℹ️ Centre d'aide & Informations
          </h2>
          
          <!-- Corps déroulant -->
          <div class="help-modal-body">
            
            <!-- CHAPITRE 1 : Sécurité & Confidentialité -->
            <section class="help-section">
              <h3 class="help-section-title">
                🔒 Sécurité & Confidentialité
              </h3>
              <p>
                <strong>Aucun serveur intermédiaire :</strong> Cette application fonctionne intégralement dans votre navigateur web (architecture <em>Client-Side</em>). Aucune donnée personnelle, financière ou statistique n'est collectée, analysée ou transmise à un serveur distant géré par nos soins.
              </p>
              <p>
                <strong>Stockage sous votre contrôle :</strong> L'ensemble de vos données (profil fiscal, comptes, valeurs) est sauvegardé exclusivement et directement sur le service de stockage Cloud que vous avez choisi et autorisé.
              </p>
            </section>

            <!-- CHAPITRE 2 : FAQ -->
            <section class="help-section">
              <h3 class="help-section-title">
                ❓ Foire Aux Questions (FAQ)
              </h3>
              
              <!-- FAQ 1 : Stockage -->
              <div class="help-faq-card">
                <h4 class="help-faq-question">
                  Où sont stockées mes données ?
                </h4>
                
                <div class="help-provider-block">
                  <strong class="help-provider-title">• Google Drive</strong>
                  <p class="help-provider-text">
                    Les données sont conservées dans le fichier <code>patrimoine_data.json</code> placé par défaut à la racine de votre espace (<em>"Mon Drive"</em>).
                  </p>
                  <ul class="help-provider-list">
                    <li><strong>Déplacement libre :</strong> Vous pouvez renommer et déplacer ce fichier dans le dossier de votre choix. L'application continuera de le retrouver grâce à son identifiant unique.</li>
                    <li><strong>Isolation stricte :</strong> L'accès accordé à l'application est limité exclusivement aux fichiers qu'elle a elle-même créés (périmètre <code>drive.file</code>). Elle n'a aucun accès au reste de vos documents.</li>
                    <li><strong>Pourquoi l'email est demandé :</strong> L'application a besoin de votre adresse email uniquement pour permettre le renouvellement automatique du jeton d'accès sans vous demander de vous reconnecter. Cet email n'est stocké que localement dans votre navigateur et n'est jamais transmis à nos serveurs.</li>
                    <li><strong>Fenêtre furtive :</strong> Lors du renouvellement automatique du jeton d'accès (toutes les heures), Google peut afficher brièvement une fenêtre de confirmation pour des raisons de sécurité. Ce comportement est imposé par Google et ne peut être désactivé. La fenêtre s'affiche furtivement puis se ferme automatiquement.</li>
                  </ul>
                </div>
              </div>

              <!-- FAQ 2 : Signaler un dysfonctionnement -->
              <div class="help-faq-card">
                <h4 class="help-faq-question">
                  Comment signaler un dysfonctionnement ?
                </h4>
                <p>
                  Les bugs et demandes d'améliorations sont centralisés sur la page GitHub du projet : 
                  <a href="https://github.com/fathzer/mon-patrimoine/issues" target="_blank" rel="noopener noreferrer" class="help-link">Issues GitHub</a>.
                </p>
                <p>
                  Quelques conseils avant de rédiger un ticket :
                </p>
                <ul class="help-provider-list">
                  <li><strong>Vérifiez les doublons :</strong> Assurez-vous que le sujet n'a pas déjà été signalé ou traité par un autre utilisateur.</li>
                  <li><strong>Soyez précis :</strong> Décrivez les étapes exactes permettant de reproduire l'erreur, ainsi que le comportement attendu.</li>
                  <li><strong>Courtoisie :</strong> Gardez à l'esprit que ce projet est développé et maintenu sur du temps personnel bénévole. Une communication courtoise et constructive est toujours appréciée !</li>
                </ul>
              </div>

              <!-- FAQ 3 : Code source -->
              <div class="help-faq-card">
                <h4 class="help-faq-question">
                  Où trouver le code source de ce projet ?
                </h4>
                <p>
                  L'application est 100% open-source. Vous pouvez consulter, inspecter ou contribuer au code directement sur le dépôt GitHub : 
                  <a href="https://github.com/fathzer/mon-patrimoine" target="_blank" rel="noopener noreferrer" class="help-link">github.com/fathzer/mon-patrimoine</a>.
                </p>
              </div>
            </section>

            <!-- CHAPITRE 3 : Limitation de responsabilité -->
            <section class="help-section" style="margin-bottom: 0.5rem;">
              <h3 class="help-section-title">
                ⚠️ Limitation de responsabilité
              </h3>
              <div class="help-disclaimer-box">
                <p>
                  Cet outil est mis à disposition à titre purement indicatif et personnel afin d'aider à la simulation et au suivi de patrimoine.
                </p>
                <p>
                  Malgré tout le soin apporté à la précision des algorithmes et des règles fiscales (PEA, CSG/CRDS, PFU...), des inexactitudes ou évolutions réglementaires peuvent survenir. Les estimations fournies ne constituent en aucun cas des conseils financiers, juridiques ou fiscaux officiels. L'auteur décline toute responsabilité quant à l'utilisation faite de ces données ou aux décisions financières qui en découleraient.
                </p>
              </div>
            </section>

          </div>

          <!-- Pied de modale -->
          <div class="modal-actions help-modal-footer">
            <p style="margin: 0; font-size: var(--font-size-sm);">
              <a href="privacy.html" target="_blank" rel="noopener noreferrer" class="help-link">Politique de confidentialité</a>
              &nbsp;•&nbsp;
              <a href="terms.html" target="_blank" rel="noopener noreferrer" class="help-link">Conditions d'utilisation</a>
            </p>
            <button type="button" id="btn-close-help" class="btn-primary">
              Fermer
            </button>
          </div>

        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const closeBtn = this.container.querySelector('#btn-close-help');
    const overlay = this.container.querySelector('.modal-overlay');

    const close = () => {
      this.container.innerHTML = '';
    };

    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
  }
}