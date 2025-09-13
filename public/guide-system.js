// Système de Guide Interactif avec Popups
class InteractiveGuide {
    constructor() {
        this.currentStep = 0;
        this.isActive = false;
        this.guideSteps = [];
        this.overlay = null;
        this.popup = null;
        this.init();
    }

    init() {
        this.createGuideUI();
        this.loadGuideSteps();
        this.loadGuideState();
    }

    createGuideUI() {
        // Créer le bouton de contrôle du guide
        const guideButton = document.createElement('div');
        guideButton.id = 'guide-control';
        guideButton.innerHTML = `
            <button id="toggle-guide" class="guide-btn">
                <i class="fas fa-question-circle"></i>
                Guide
            </button>
            <button id="cancel-guide" class="guide-btn cancel" style="display: none;">
                <i class="fas fa-times"></i>
                Annuler
            </button>
        `;
        document.body.appendChild(guideButton);

        // Styles pour le guide
        const style = document.createElement('style');
        style.textContent = `
            #guide-control {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                gap: 10px;
            }

            .guide-btn {
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 15px;
                border-radius: 25px;
                cursor: pointer;
                font-size: 14px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                transition: all 0.3s ease;
            }

            .guide-btn:hover {
                background: #0056b3;
                transform: translateY(-2px);
            }

            .guide-btn.cancel {
                background: #dc3545;
            }

            .guide-btn.cancel:hover {
                background: #c82333;
            }

            .guide-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                z-index: 9999;
                pointer-events: none;
            }

            .guide-popup {
                position: absolute;
                background: white;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                max-width: 400px;
                z-index: 10001;
                pointer-events: auto;
                animation: slideIn 0.3s ease;
            }

            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .guide-popup .header {
                background: #007bff;
                color: white;
                padding: 15px 20px;
                border-radius: 10px 10px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .guide-popup .content {
                padding: 20px;
            }

            .guide-popup .title {
                font-size: 18px;
                font-weight: bold;
                margin: 0;
            }

            .guide-popup .description {
                margin: 15px 0;
                line-height: 1.5;
                color: #333;
            }

            .guide-popup .actions {
                display: flex;
                gap: 10px;
                justify-content: flex-end;
                margin-top: 20px;
            }

            .guide-popup .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
            }

            .guide-popup .btn-primary {
                background: #007bff;
                color: white;
            }

            .guide-popup .btn-secondary {
                background: #6c757d;
                color: white;
            }

            .guide-popup .btn-danger {
                background: #dc3545;
                color: white;
            }

            .guide-popup .btn:hover {
                opacity: 0.9;
            }

            .guide-step-indicator {
                text-align: center;
                margin-top: 15px;
                color: #666;
                font-size: 12px;
            }

            .guide-highlight {
                position: relative;
                z-index: 10000;
                box-shadow: 0 0 0 4px #007bff, 0 0 0 8px rgba(0,123,255,0.3);
                border-radius: 4px;
                transition: all 0.3s ease;
            }
        `;
        document.head.appendChild(style);

        // Event listeners
        document.getElementById('toggle-guide').addEventListener('click', () => this.toggleGuide());
        document.getElementById('cancel-guide').addEventListener('click', () => this.cancelGuide());
    }

    loadGuideSteps() {
        // Définir les étapes du guide pour chaque page
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        this.guideSteps = {
            'index.html': [
                {
                    target: 'h1',
                    title: 'Bienvenue sur Zalagh Plancher',
                    description: 'Cette page d\'accueil vous permet de naviguer vers les différentes sections de l\'application.',
                    position: 'bottom'
                },
                {
                    target: 'form',
                    title: 'Connexion',
                    description: 'Utilisez ce formulaire pour vous connecter en tant qu\'administrateur ou employé.',
                    position: 'right'
                },
                {
                    target: '.gallery',
                    title: 'Galerie',
                    description: 'Découvrez nos projets et notre flotte de véhicules.',
                    position: 'left'
                }
            ],
            'admin.html': [
                {
                    target: '.brand',
                    title: 'Espace Administrateur',
                    description: 'Bienvenue dans l\'espace administrateur. Ici vous pouvez gérer tous les aspects de l\'entreprise.',
                    position: 'bottom'
                },
                {
                    target: 'nav',
                    title: 'Navigation Admin',
                    description: 'Utilisez ces onglets pour naviguer entre les différentes sections : Employés, Demandes, Assistant.',
                    position: 'bottom'
                },
                {
                    target: '#section-employes',
                    title: 'Gestion des Employés',
                    description: 'Ici vous pouvez ajouter, modifier et gérer les employés de l\'entreprise.',
                    position: 'top'
                },
                {
                    target: '#section-demandes',
                    title: 'Gestion des Demandes',
                    description: 'Consultez et gérez toutes les demandes de clients.',
                    position: 'top'
                },
                {
                    target: '#section-assistant',
                    title: 'Assistant IA',
                    description: 'Utilisez l\'assistant IA pour obtenir de l\'aide et des réponses automatiques.',
                    position: 'top'
                }
            ],
            'employee-login.html': [
                {
                    target: 'h1',
                    title: 'Connexion Employé',
                    description: 'Connectez-vous avec vos identifiants employé pour accéder à votre espace personnel.',
                    position: 'bottom'
                },
                {
                    target: 'form',
                    title: 'Formulaire de Connexion',
                    description: 'Entrez votre email et mot de passe pour accéder à votre tableau de bord.',
                    position: 'right'
                }
            ],
            'employee-dashboard.html': [
                {
                    target: '.brand',
                    title: 'Tableau de Bord Employé',
                    description: 'Bienvenue dans votre espace personnel. Ici vous pouvez voir vos notifications et gérer vos tâches.',
                    position: 'bottom'
                },
                {
                    target: 'nav',
                    title: 'Navigation Employé',
                    description: 'Utilisez ces onglets pour naviguer entre vos différentes sections.',
                    position: 'bottom'
                },
                {
                    target: '#section-notifications',
                    title: 'Notifications',
                    description: 'Consultez vos notifications et répondez aux messages de l\'administration.',
                    position: 'top'
                },
                {
                    target: '#section-demandes',
                    title: 'Mes Demandes',
                    description: 'Gérez les demandes qui vous sont assignées.',
                    position: 'top'
                }
            ],
            'employee-profile.html': [
                {
                    target: '.brand',
                    title: 'Profil Employé',
                    description: 'Gérez votre profil et vos informations personnelles.',
                    position: 'bottom'
                },
                {
                    target: 'form',
                    title: 'Informations Personnelles',
                    description: 'Mettez à jour vos informations personnelles et changez votre mot de passe.',
                    position: 'right'
                }
            ]
        }[currentPage] || [];
    }

    toggleGuide() {
        if (this.isActive) {
            this.stopGuide();
        } else {
            this.startGuide();
        }
    }

    startGuide() {
        if (this.guideSteps.length === 0) {
            alert('Aucun guide disponible pour cette page.');
            return;
        }

        this.isActive = true;
        this.currentStep = 0;
        this.showStep();
        this.updateUI();
        this.saveGuideState();
    }

    stopGuide() {
        this.isActive = false;
        this.hidePopup();
        this.removeHighlight();
        this.updateUI();
        this.saveGuideState();
    }

    cancelGuide() {
        this.stopGuide();
        this.currentStep = 0;
    }

    showStep() {
        if (!this.isActive || this.currentStep >= this.guideSteps.length) {
            this.stopGuide();
            return;
        }

        const step = this.guideSteps[this.currentStep];
        const target = document.querySelector(step.target);

        if (!target) {
            this.nextStep();
            return;
        }

        this.highlightElement(target);
        this.showPopup(target, step);
    }

    highlightElement(element) {
        this.removeHighlight();
        element.classList.add('guide-highlight');
    }

    removeHighlight() {
        document.querySelectorAll('.guide-highlight').forEach(el => {
            el.classList.remove('guide-highlight');
        });
    }

    showPopup(target, step) {
        this.hidePopup();

        const rect = target.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.className = 'guide-popup';
        
        popup.innerHTML = `
            <div class="header">
                <h3 class="title">${step.title}</h3>
                <button onclick="guideSystem.closePopup()" style="background: none; border: none; color: white; font-size: 18px; cursor: pointer;">×</button>
            </div>
            <div class="content">
                <p class="description">${step.description}</p>
                <div class="actions">
                    ${this.currentStep > 0 ? '<button class="btn btn-secondary" onclick="guideSystem.previousStep()">Précédent</button>' : ''}
                    <button class="btn btn-primary" onclick="guideSystem.nextStep()">
                        ${this.currentStep === this.guideSteps.length - 1 ? 'Terminer' : 'Suivant'}
                    </button>
                    <button class="btn btn-danger" onclick="guideSystem.cancelGuide()">Annuler</button>
                </div>
                <div class="guide-step-indicator">
                    Étape ${this.currentStep + 1} sur ${this.guideSteps.length}
                </div>
            </div>
        `;

        document.body.appendChild(popup);
        this.popup = popup;

        // Positionner le popup
        this.positionPopup(popup, rect, step.position);
    }

    positionPopup(popup, rect, position) {
        const popupRect = popup.getBoundingClientRect();
        let top, left;

        switch (position) {
            case 'top':
                top = rect.top - popupRect.height - 20;
                left = rect.left + (rect.width - popupRect.width) / 2;
                break;
            case 'bottom':
                top = rect.bottom + 20;
                left = rect.left + (rect.width - popupRect.width) / 2;
                break;
            case 'left':
                top = rect.top + (rect.height - popupRect.height) / 2;
                left = rect.left - popupRect.width - 20;
                break;
            case 'right':
                top = rect.top + (rect.height - popupRect.height) / 2;
                left = rect.right + 20;
                break;
            default:
                top = rect.bottom + 20;
                left = rect.left + (rect.width - popupRect.width) / 2;
        }

        // Ajuster si le popup sort de l'écran
        if (left < 20) left = 20;
        if (left + popupRect.width > window.innerWidth - 20) {
            left = window.innerWidth - popupRect.width - 20;
        }
        if (top < 20) top = 20;
        if (top + popupRect.height > window.innerHeight - 20) {
            top = window.innerHeight - popupRect.height - 20;
        }

        popup.style.top = top + 'px';
        popup.style.left = left + 'px';
    }

    hidePopup() {
        if (this.popup) {
            this.popup.remove();
            this.popup = null;
        }
    }

    nextStep() {
        this.currentStep++;
        this.showStep();
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep();
        }
    }

    closePopup() {
        this.hidePopup();
    }

    updateUI() {
        const toggleBtn = document.getElementById('toggle-guide');
        const cancelBtn = document.getElementById('cancel-guide');
        
        if (this.isActive) {
            toggleBtn.textContent = 'Arrêter Guide';
            cancelBtn.style.display = 'block';
        } else {
            toggleBtn.innerHTML = '<i class="fas fa-question-circle"></i> Guide';
            cancelBtn.style.display = 'none';
        }
    }

    saveGuideState() {
        localStorage.setItem('guideActive', this.isActive);
        localStorage.setItem('guideStep', this.currentStep);
    }

    loadGuideState() {
        const active = localStorage.getItem('guideActive') === 'true';
        const step = parseInt(localStorage.getItem('guideStep') || '0');
        
        if (active) {
            this.isActive = true;
            this.currentStep = step;
            this.updateUI();
        }
    }
}

// Initialiser le système de guide
const guideSystem = new InteractiveGuide();
