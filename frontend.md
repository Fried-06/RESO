# ASECNA Network Monitor — Documentation Frontend

## 1. Vue d’ensemble de l’architecture frontend

L'interface de l'application **ASECNA Network Monitor** a été conçue comme une console professionnelle de supervision et diagnostic d'infrastructures critiques pour l'aviation civile (CNS/ATM). Elle est bâtie sur la pile moderne :

- **Tauri 2** : Pont IPC natif haute performance avec le backend Rust.
- **React 19** & **TypeScript 5.8** : Interface déclarative, typage strict de bout en bout calqué sur les modèles de données Rust.
- **Vite 8** : Bundler ultra-rapide avec compilation modulaire et hot reload.
- **Tailwind CSS v4** : Système de design par jetons CSS natifs, variables dynamiques pour le mode sombre et le mode clair.
- **Lightswind** : Bibliothèque de composants d'interface desktop source-first (Boutons, Cartes, Badges, Modales, Tables, Squelettes de chargement, Recherche extensible, Accordéons, Infobulles, et Dock de navigation).
- **Bklit** : Bibliothèque de graphiques vectoriels composables sur base Visx et animations fluides (Donut / Ring chart pour la disponibilité, Courbe temporelle lissée avec réticule interactif pour la latence RTT).

### Principes architecturaux stricts
1. **Zéro simulation / Zéro mock** : Aucun faux équipement, aucun faux utilisateur, aucune donnée inventée. Lorsque la base de données SQLite ne contient aucun enregistrement, des états vides explicites et institutionnels orientent l'opérateur.
2. **Identité visuelle ASECNA & Aviation Civile** : Palette institutionnelle Bleu Aviation (`#0B2545`), accents ciel (`#0284C7`), indicateurs d'état conformes à l'exploitation aéronautique (Émeraude opérationnel, Ambre dégradé, Rose/Rouge hors ligne).
3. **Navigation par Dock inférieur** : Remplacement des barres latérales encombrantes par un dock flottant incurvé en bas d'écran avec effet de verre dépoli (*glassmorphism*).
4. **Prise en charge native Dark/Light** : Bascule instantanée entre le mode jour haute lisibilité et le mode nuit pour les salles de contrôle opérationnelles.

---

## 2. Arborescence complète des fichiers créés

```text
asecreso/
├── index.html                               # Point d'entrée HTML, Google Fonts (Lexend Deca), Favicon ASECNA
├── tsconfig.json                            # Configuration TypeScript, alias @/ -> ./src
├── vite.config.ts                           # Configuration Vite, plugin Tailwind v4, alias d'import
├── frontend.md                              # Cette documentation complète
└── src/
    ├── main.tsx                             # Bootstrap React et inclusion du style global index.css
    ├── App.tsx                              # Orchestration principale, ThemeProvider, AuthProvider, AppShell
    ├── index.css                            # Jetons de design Tailwind v4, variables de thème clair/sombre
    │
    ├── assets/
    │   ├── Logo_ASECNA.png                  # Logo officiel de l'ASECNA
    │   └── 6v-cev-asecna-..._o.jpg          # Visuel Cessna Citation Sovereign ASECNA
    │
    ├── lib/
    │   └── utils.ts                         # Utilitaire de fusion de classes Tailwind (clsx + twMerge)
    │
    ├── context/
    │   ├── ThemeContext.tsx                 # Gestion du thème clair/sombre et persistance localStorage
    │   └── AuthContext.tsx                  # Gestion de session, vérification bootstrap, connexion/déconnexion
    │
    ├── types/
    │   ├── auth.ts                          # Contrats TypeScript Auth (UserDto, LoginRequest, etc.)
    │   ├── device.ts                        # Contrats TypeScript Équipements (DeviceDto, ServiceConfig, etc.)
    │   ├── diagnostic.ts                    # Contrats TypeScript Diagnostics (Ping, Tcp, Http, Overview, History)
    │   ├── settings.ts                      # Contrats TypeScript Paramètres (SettingsDto, UpdateSettingsRequest)
    │   └── index.ts                         # Barrel export des types
    │
    ├── services/
    │   └── tauri/
    │       ├── client.ts                    # Wrapper d'invocation IPC avec fallback sécurisé
    │       ├── auth.ts                      # Invocations des commandes Tauri d'authentification
    │       ├── devices.ts                   # Invocations des commandes Tauri CRUD équipements
    │       ├── diagnostics.ts               # Invocations des sondes ICMP, TCP, HTTP et de l'overview
    │       ├── settings.ts                  # Invocations des commandes de configuration du moteur
    │       └── index.ts                     # Barrel export des services Tauri
    │
    ├── components/
    │   ├── ui/                              # Composants d'interface Lightswind
    │   │   ├── Button.tsx                   # Bouton multi-variantes avec état de chargement
    │   │   ├── Card.tsx                     # Conteneurs de cartes modulaires
    │   │   ├── Badge.tsx                    # Badges de statut et de couche réseau (L3 / L7)
    │   │   ├── Input.tsx                    # Champs de saisie avec icônes et gestion d'erreurs
    │   │   ├── Dialog.tsx                   # Modale accessible avec fond semi-transparent flouté
    │   │   ├── Table.tsx                    # Tableau haute lisibilité avec survol de ligne
    │   │   ├── Skeleton.tsx                 # Squelette pulsé pour les états de chargement
    │   │   ├── ExpandableSearchBar.tsx      # Barre de recherche extensible et fluide
    │   │   ├── Accordion.tsx                # Accordéon pour les détails diagnostiques L3 vs L7
    │   │   ├── Tooltip.tsx                  # Infobulles contextuelles
    │   │   └── index.ts                     # Barrel export UI
    │   │
    │   ├── charts/                          # Graphiques vectoriels Bklit
    │   │   ├── RingChart.tsx                # Graphique circulaire Donut de répartition disponibilité
    │   │   ├── LineChart.tsx                # Graphique temporel SVG avec gradient et réticule interactif
    │   │   └── index.ts                     # Barrel export charts
    │   │
    │   └── layout/                          # Structure et enveloppe applicative
    │       ├── Header.tsx                   # En-tête institutionnel, état moteur, profil et bascule de thème
    │       ├── Dock.tsx                     # Dock de navigation flottant Lightswind
    │       ├── AppShell.tsx                 # Conteneur global intégrant Header, Main et Dock
    │       └── index.ts                     # Barrel export layout
    │
    └── pages/
        ├── Auth/
        │   └── AuthPage.tsx                 # Écran d'initialisation (Bootstrap) ou de connexion opérateur
        ├── Overview/
        │   └── OverviewPage.tsx             # Tableau de bord, métriques clés, graphiques Bklit, alertes
        ├── Devices/
        │   ├── DevicesPage.tsx              # Inventaire du parc, recherche, filtres, actions rapides
        │   └── DeviceFormDialog.tsx         # Dialogue d'ajout/modification avec services L7
        ├── Diagnostics/
        │   └── DiagnosticsPage.tsx          # Sondes L3/L7, outils ad-hoc (Ping/TCP/HTTP) et historique
        └── Settings/
            └── SettingsPage.tsx             # Paramètres de scan, timeouts, concurrence et sécurité
```

---

## 3. Intégration Lightswind

Les composants Lightswind ont été intégrés selon l'approche source-first : les fichiers de composants résident directement dans `src/components/ui/` pour un contrôle complet sur le rendu et les animations.

### Composants intégrés et personnalisations
- **Button** (`Button.tsx`) : Prend en charge les variantes `primary`, `secondary`, `outline`, `ghost`, `destructive` et `accent`. Il intègre nativement un indicateur de chargement rotatif (`isLoading`) tout en désactivant les clics intempestifs.
- **Card** (`Card.tsx`) : Structure modulaire (`Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`) avec bordures subtiles et ombres légères.
- **Badge** (`Badge.tsx`) : Utilisé pour matérialiser les statuts opérationnels (`success` pour les services fonctionnels, `warning` pour les dégradations L7, `destructive` pour les équipements hors ligne, et `outline` pour les étiquettes de protocole).
- **Input** (`Input.tsx`) : Champs de formulaire avec intégration d'icônes à gauche, affichage dynamique des messages de validation et contour actif aux couleurs d'accentuation.
- **Dialog** (`Dialog.tsx`) : Modale accessible avec fermeture par touche Échap, clic en arrière-plan et verrouillage du défilement.
- **Table** (`Table.tsx`) : Table de données épurée avec en-têtes majuscules discrets, séparateurs de rangée et survol interactif.
- **ExpandableSearchBar** (`ExpandableSearchBar.tsx`) : Barre de recherche interactive qui s'agrandit doucement au focus et offre un bouton de réinitialisation rapide.
- **AccordionItem** (`Accordion.tsx`) : Composant de pliage/dépliage permettant d'isoler les résultats détaillés de la couche L3 (ICMP) et de chaque service L7 (ports TCP ou requêtes HTTP).

---

## 4. Intégration Bklit (Graphiques)

Les graphiques sont basés sur les principes de la bibliothèque Bklit : légers, vectoriels (SVG), animés avec fluidité et réactifs aux interactions souris.

### 1. RingChart (`RingChart.tsx`)
- **Usage** : Visualisation du taux global de disponibilité du parc sur la page Vue d'ensemble.
- **Données** : Segments ventilés selon l'état réel des équipements (Opérationnels en vert émeraude, Dégradés en ambre, Hors ligne en rouge).
- **Rendu** : Arc circulaire dynamique avec calcul de la circonférence et du `strokeDasharray`.
- **Centre métrique** : Affiche en grand le pourcentage de disponibilité consolidé (`ex: 100%`) ou le nombre d'équipements sous surveillance.
- **État vide** : Lorsque aucun équipement n'est configuré (total = 0), un anneau neutre est affiché avec le libellé « Aucune donnée ».

### 2. LineChart (`LineChart.tsx`)
- **Usage** : Visualisation de l'évolution temporelle de la latence RTT (couche L3).
- **Rendu** : Tracé vectoriel en courbe de Bézier cubique avec remplissage en dégradé vertical (`linearGradient`).
- **Curseur et infobulle** : Un détecteur d'événement sur la souris identifie le point le plus proche et projette un réticule vertical en tiretés ainsi qu'une infobulle flottante indiquant la valeur précise en millisecondes et l'horodatage.
- **État vide** : Si aucun historique n'est présent, un conteneur en bordure pointillée indique sobrement qu'aucune mesure n'est encore disponible.

---

## 5. Système de navigation (Dock Lightswind)

Conformément au cahier des charges, l'application s'affranchit de la barre latérale traditionnelle au profit du **Dock flottant Lightswind** ancré au bas de l'écran (`Dock.tsx`).

### Structure du Dock
Le dock est centré horizontalement et maintenu au-dessus du contenu grâce à un positionnement fixe (`fixed bottom-4 left-1/2 -translate-x-1/2 z-40`). Il est composé de 4 onglets principaux :

1. **Vue d’ensemble** (`LayoutDashboard`) : Métriques globales, graphiques Bklit de disponibilité et latence, liste d'attention prioritaire.
2. **Équipements** (`Server`) : Inventaire complet des nœuds réseau, recherche, filtrage, ajout/modification et suppression.
3. **Diagnostics** (`Activity`) : Déclenchement de diagnostics approfondis L3/L7, sondes ad-hoc instantanées (ICMP Ping, port TCP, requête HTTP) et historique horodaté.
4. **Paramètres** (`Sliders`) : Paramétrage du moteur asynchrone (intervalle de scan, timeout, concurrence), bascule de thème et changement de mot de passe opérateur.

### Ergonomie du Dock
- Effet de verre dépoli avec flou d'arrière-plan (`backdrop-blur-xl bg-background/85`).
- Mise en valeur de l'onglet actif avec couleur primaire institutionnelle et micro-agrandissement (`scale-[1.02]`).
- Adaptation mobile : les libellés textuels se masquent automatiquement sur écran étroit au profit d'icônes nettes et d'un indicateur lumineux de position.

---

## 6. Communication avec le backend Rust / Tauri

La communication s'effectue exclusivement par des appels de fonctions distantes (RPC) via `@tauri-apps/api/core` (`invoke()`).

### Wrapper sécurisé (`client.ts`)
Toutes les invocations transitent par `tauriInvoke<T>(command, args)`. Ce module intercepte les contextes d'exécution sans runtime Tauri actif (développement web isolé ou tests) en émettant un avertissement explicite sans faire crasher l'interface.

### Commandes Tauri reliées
| Commande Tauri | Module Rust | Rôle frontend |
|---|---|---|
| `is_bootstrap_required` | `commands::auth` | Détecte si un premier compte admin doit être créé |
| `create_first_user` | `commands::auth` | Initialise le premier administrateur |
| `login` | `commands::auth` | Authentifie l'opérateur et délivre un token de session |
| `logout` | `commands::auth` | Clôture la session en mémoire sur le backend |
| `get_current_user` | `commands::auth` | Valide la persistance de session au chargement |
| `change_password` | `commands::auth` | Modifie le mot de passe du compte actif |
| `get_devices` | `commands::devices` | Récupère l'inventaire des équipements configurés |
| `get_device` | `commands::devices` | Récupère le détail d'un équipement |
| `create_device` | `commands::devices` | Ajoute un équipement avec ses services L7 |
| `update_device` | `commands::devices` | Met à jour un équipement existant |
| `delete_device` | `commands::devices` | Supprime un équipement et son historique en cascade |
| `run_ping` | `commands::diagnostics` | Exécute un Ping ICMP ad-hoc (WinPing API) |
| `run_tcp_test` | `commands::diagnostics` | Teste un port TCP ad-hoc |
| `run_http_test` | `commands::diagnostics` | Teste une URL HTTP/HTTPS ad-hoc |
| `run_device_diagnostic` | `commands::diagnostics` | Exécute un contrôle complet L3 + L7 pour un équipement |
| `get_network_overview` | `commands::diagnostics` | Scan concurrent de l'ensemble du parc |
| `get_device_history` | `commands::diagnostics` | Récupère les derniers diagnostics d'un équipement |
| `get_settings` | `commands::settings` | Récupère la configuration globale du moteur |
| `update_settings` | `commands::settings` | Met à jour les paramètres de scan et timeouts |

---

## 7. Gestion des états

L'application emploie des contextes React légers et natifs sans dépendances tierces lourdes :

1. **`ThemeContext`** :
   - Mémorise le mode `light` ou `dark` dans le `localStorage` (`asecna_theme_preference`).
   - Applique la classe `dark` directement sur l'élément racine `<html>` du DOM.
   - Initialise par défaut le mode selon la préférence du système d'exploitation si aucune clé n'est enregistrée.
2. **`AuthContext`** :
   - Gère le jeton de session (`asecna_session_token`) et l'objet `UserDto`.
   - Interroge au démarrage `is_bootstrap_required` : si la base est vierge, oriente directement vers l'écran d'initialisation.
   - En cas de session existante, vérifie la validité du token via `getCurrentUser` avant d'autoriser l'accès.
3. **États de vues locaux** :
   - Chaque page maintient ses états de données fraîches, d'indicateurs de rafraîchissement asynchrone (`isRefreshing`), d'erreurs de réseau et de pagination/filtrage.
   - Navigation croisée : un clic sur « Diagnostiquer » dans la page *Équipements* injecte l'équipement sélectionné directement dans l'onglet *Diagnostics*.

---

## 8. Charte graphique et décisions de design

L'interface évite tout effet néon artificiel ou apparence de template SaaS grand public. Elle traduit la rigueur technique de l'**ASECNA** :

### Typographie
- Police principale : **Lexend Deca** (graisses 400, 500, 600, 700), sélectionnée pour sa lisibilité exceptionnelle, ses chiffres clairs et sa géométrie nette adaptée aux écrans de contrôle.
- Police monospace : polices système monospaces (`font-mono`) pour les adresses IP, les ports, les codes HTTP et les latences.

### Palette de couleurs institutionnelle
- **Bleu Aviation Nuit (Primary)** : `#0B2545` (fond de l'écran d'accueil, boutons principaux, en-têtes).
- **Ciel Aéronautique (Accent)** : `#0284C7` (surlignages, badges de protocole, courbes graphiques).
- **Vert Opérationnel (Online / Succès)** : `#10B981` (taux normal, sondes L3/L7 réussies).
- **Ambre Dégradation (Warning / Dégradé)** : `#F59E0B` (liaison L3 active mais service L7 défaillant).
- **Rose / Rouge Alerte (Offline / Échec)** : `#EF4444` (équipement injoignable par ICMP).

---

## 9. Détail de chaque vue / écran

### 1. Authentification & Bootstrap (`AuthPage.tsx`)
- **Mode Initialisation (si base vide)** : Titré « Initialisation Administrateur », invite l'opérateur à créer le compte d'administration initial (validation du mot de passe sur 8 caractères minimum et confirmation).
- **Mode Connexion Opérateur** : Authentification standard par identifiant et mot de passe.
- **Scénographie** : Volet gauche arborant la photo institutionnelle de l'avion ASECNA Citation Sovereign, le logo officiel et les engagements de résilience opérationnelle ; volet droit accueillant le formulaire d'authentification.

### 2. Vue d'ensemble (`OverviewPage.tsx`)
- **Cartes KPI** : Équipements Actifs, Équipements Opérationnels (L3+L7), Services Dégradés, Équipements Hors Ligne.
- **Disponibilité globale** : Donut Bklit (`RingChart`) calculant en temps réel le pourcentage de disponibilité.
- **Santé de latence** : Graphique temporel Bklit (`LineChart`) montrant les variations du temps d'aller-retour RTT en millisecondes.
- **Section Attention Immédiate** : Liste prioritaire des équipements dégradés ou hors ligne avec bouton d'accès direct au diagnostic.

### 3. Parc des Équipements (`DevicesPage.tsx`)
- **Inventaire tabulaire** : Colonnes pour le nom et IP de l'équipement, son statut calculé, les badges de services L7 associés, la date d'enregistrement et les actions.
- **Recherche & Filtrage** : Recherche fluide par texte et filtre déroulant par statut (`Opérationnel`, `Dégradé`, `Hors ligne`, `En attente`).
- **Dialogue de gestion** (`DeviceFormDialog.tsx`) : Permet de configurer le nom, l'IP, la description et d'ajouter dynamiquement des services applicatifs (soit un port TCP, soit un endpoint HTTP).

### 4. Diagnostics (`DiagnosticsPage.tsx`)
- **Sous-onglet Diagnostic Équipement** : Sélectionne un équipement configuré et exécute simultanément la sonde L3 (ICMP) et toutes les sondes L7 associées. Affiche un bilan consolidé avec accordéon détaillé par couche et tableau des 10 dernières sondes issues de la base SQLite.
- **Sous-onglet Sondes Ad-hoc** : Permet de tester instantanément n'importe quelle adresse IP ou nom d'hôte sans configuration préalable :
  - Sonde Ping ICMP avec WinPing.
  - Sonde TCP avec tentative de connexion sur port spécifique (ex: 22, 80, 443).
  - Sonde HTTP/HTTPS avec relevé du code d'état et du temps de réponse.

### 5. Paramètres Système (`SettingsPage.tsx`)
- **Moteur de supervision** : Configuration de l'intervalle d'échantillonnage automatique (en secondes), du délai d'attente limite (*timeout* en ms), du seuil maximal de sondes asynchrones concurrentes et du scan au démarrage.
- **Affichage** : Sélecteur visuel direct pour basculer entre le mode Jour (clair) et le mode Nuit (sombre).
- **Sécurité** : Formulaire de modification sécurisée du mot de passe de l'opérateur connecté.
- **Informations système** : Fiche technique rappelant l'architecture Tauri 2, la version de SQLite et le moteur de sonde native WinPing.

---

## 10. Gestion des états vides (Empty States)

Le respect du principe **Zéro Mock** implique une gestion soignée des états où aucune donnée n'est présente :

1. **Base SQLite sans équipement** :
   - La Vue d'ensemble affiche un panneau institutionnel avec l'icône serveur, un texte clair expliquant qu'aucun équipement n'est surveillé et un bouton d'action principale invitant à « Ajouter un premier équipement ».
   - L'anneau Bklit affiche un contour neutre avec la mention « Aucune donnée ».
   - La courbe de latence affiche un cadre en pointillés avec le message « Aucune mesure de latence enregistrée pour le moment ».
2. **Équipement sans historique de diagnostic** :
   - Le tableau d'historique de la page Diagnostics informe l'utilisateur : « Aucun historique enregistré pour cet équipement. Lancez un diagnostic pour enregistrer une première mesure. »
3. **Filtre de recherche sans résultat** :
   - Un message sobre indique « Aucun équipement ne correspond aux critères de recherche actuels. »

---

## 11. Gestion du mode clair / mode sombre

- Les couleurs sont définies par des variables CSS dans `src/index.css` sous `:root` et `.dark`.
- En mode clair, l'arrière-plan offre un contraste net (`#F8FAFC`) pour une utilisation bureautique en plein jour.
- En mode sombre, l'arrière-plan bascule sur un gris très profond (`#0B132B` / `#0F172A`) sans éblouissement, parfaitement adapté aux environnements de vigie ou de tour de contrôle.
- Le dock, les modales et l'en-tête exploitent un flou d'arrière-plan dynamique qui s'adapte automatiquement à la luminosité ambiante.

---

## 12. Instructions d'exécution et de build

### Prérequis
- **Node.js** : v20 ou supérieur (v22.21.1 validé).
- **Rust** : 1.80 ou supérieur (avec Cargo).
- **Système** : Windows 10/11 x64 (APIs réseau WinPing natives).

### Lancement en mode développement
Dans le répertoire du projet `asecreso/` :
```bash
# Lancement de Vite seul pour inspection UI web
npm run dev

# Ou lancement complet de l'application desktop Tauri 2
cargo tauri dev
```

### Compilation et validation pour la production
```bash
# Validation du code TypeScript et compilation des assets Vite
npm run build

# Génération du binaire desktop autonome Tauri
cargo tauri build
```
Le résultat de la compilation produit le bundle web dans `dist/` et l'exécutable natif dans `src-tauri/target/release/`.

---

## 13. Points d’attention et évolutions futures

1. **Privilèges ICMP sous Windows** : L'implémentation backend utilise l'API système unprivilégiée `IcmpSendEcho2` via `winping`. Aucune élévation administrateur (UAC) n'est requise pour faire fonctionner les pings.
2. **Certificats SSL auto-signés** : Pour les équipements réseau embarquant des certificats HTTPS internes non signés par une autorité publique, le client HTTP backend est configuré pour ne pas bloquer les diagnostics L7.
3. **Persistance des paramètres** : Toute modification apportée dans l'onglet Paramètres est directement enregistrée dans la table `settings` de la base SQLite et prend effet immédiatement sur les cycles de surveillance suivants.
