# Architecture & Implémentation du Backend — ASECNA Network Monitor

Ce document constitue la référence technique intégrale du backend de l'application desktop **ASECNA Network Monitor**, développée avec **Tauri 2**, **Rust** et **SQLite**. Il a été rédigé de façon pédagogique pour permettre à tout développeur, même débutant en Rust ou Tauri, de comprendre l'architecture, de naviguer dans le code et de le faire évoluer en toute sécurité.

---

## 1. Vue Générale

L'application suit strictement une architecture en couches unidirectionnelle (**Layered Architecture**), garantissant une séparation rigoureuse des responsabilités :

```text
       ┌────────────────────────────────────────────────────────┐
       │                 Frontend React (UI)                    │
       └──────────────────────────┬─────────────────────────────┘
                                  │ window.__TAURI__.core.invoke()
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │                Tauri Commands Layer                    │
       │              (src-tauri/src/commands/)                 │
       └──────────────────────────┬─────────────────────────────┘
                                  │ Validation & Délégation
                                  ▼
       ┌────────────────────────────────────────────────────────┐
       │               Application Services Layer               │
       │              (src-tauri/src/services/)                 │
       └─────────────────┬────────────────────┬─────────────────┘
                         │                    │
            Persistance  │                    │ Probes Réseau Réels
                         ▼                    ▼
       ┌─────────────────────────┐   ┌──────────────────────────┐
       │    Repositories Layer   │   │   Network Engine Layer   │
       │ (database/repositories) │   │  (src-tauri/src/network) │
       └────────────┬────────────┘   └────────┬─────────────────┘
                    │                         │
                    ▼                         ▼
            ┌───────────────┐        ┌─────────────────┐
            │ Base SQLite   │        │   Sockets OS    │
            │  (WAL Mode)   │        │ ICMP / TCP / HTTP│
            └───────────────┘        └─────────────────┘
```

### Règle d'or : Zéro Mock & Zéro Donnée Fictive
- **Aucun faux résultat** : les tests ICMP, TCP et HTTP contactent réellement le système d'exploitation et la carte réseau.
- **Aucune donnée pré-insérée** : la base SQLite s'initialise totalement vide (aucun équipement fictif, aucun mot de passe admin par défaut).
- **Frontière stricte** : la communication s'opère exclusivement via les commandes natives Tauri IPC (`invoke`), éliminant tout serveur HTTP local intermédiaire (pas de FastAPI, Flask ou Express).

---

## 2. Arborescence Complète

Voici l'organisation détaillée de `src-tauri/src/` :

```text
src-tauri/
├── Cargo.toml                  # Dépendances Rust strictement justifiées
├── tauri.conf.json             # Configuration de l'application de bureau Tauri 2
├── tests/
│   └── backend_tests.rs        # Suite de tests réels (crypto, DB, sockets TCP/HTTP)
└── src/
    ├── main.rs                 # Point d'entrée de l'exécutable Windows (évite console console en release)
    ├── lib.rs                  # Point d'entrée de la bibliothèque, initialisation SQLite & enregistrement Tauri
    ├── error.rs                # Gestion centralisée des erreurs & fonctions de validation
    │
    ├── models/                 # Définitions des structures de données (entités & DTOs)
    │   ├── mod.rs              # Re-export de tous les modèles
    │   ├── user.rs             # Modèle User (entité DB) et UserDto (exposition sûre)
    │   ├── device.rs           # Modèle Device, ServiceConfig (ports/protocoles) et DeviceDto
    │   ├── diagnostic.rs       # Résultats de probes (PingResult, TcpTestResult, HttpTestResult, etc.)
    │   └── settings.rs         # Paramètres globaux (scan_interval, timeout, concurrence)
    │
    ├── database/               # Couche d'accès aux données SQLite
    │   ├── mod.rs              # Re-export des modules database
    │   ├── connection.rs       # Initialisation du pool SqlitePool avec pragmas (WAL, Foreign Keys)
    │   ├── migrations.rs       # DDL SQL exécuté au démarrage (création des tables et index)
    │   └── repositories/       # Requêtes SQL 100% paramétrées (anti-injection)
    │       ├── mod.rs
    │       ├── user_repository.rs      # Opérations CRUD et vérifications sur les utilisateurs
    │       ├── device_repository.rs    # CRUD des équipements et persistance de l'historique
    │       └── settings_repository.rs  # Lecture et mise à jour de la table singleton settings
    │
    ├── network/                # Moteur d'exécution réseau réel
    │   ├── mod.rs              # Re-export des fonctions de test réseau
    │   ├── icmp.rs             # Ping ICMP natif non privilégié (IcmpSendEcho Windows via winping)
    │   ├── tcp.rs              # Test de poignée de main TCP asynchrone (Tokio)
    │   └── http.rs             # Test applicatif L7 (Reqwest HTTP/HTTPS avec code de statut réel)
    │
    ├── state/                  # Gestion de l'état partagé de l'application
    │   ├── mod.rs
    │   └── app_state.rs        # AppState (SqlitePool, SessionManager en mémoire, reqwest::Client)
    │
    ├── services/               # Logique métier et orchestration
    │   ├── mod.rs
    │   ├── auth_service.rs     # Hachage Argon2id, vérification identifiants, sessions
    │   ├── device_service.rs   # Règles métier et validation des équipements
    │   ├── diagnostic_service.rs # Exécution des tests L3/L7, agrégation de statut, analyse globale
    │   └── settings_service.rs # Validation des seuils et paramètres globaux
    │
    └── commands/               # Frontière IPC Tauri invoquée par React
        ├── mod.rs
        ├── auth.rs             # Commandes d'authentification et bootstrap
        ├── devices.rs          # Commandes CRUD équipements (protégées par session)
        ├── diagnostics.rs      # Commandes de test (ping, tcp, http, diagnostic équipement, overview)
        └── settings.rs         # Commandes de configuration de l'application
```

---

## 3. Flux Frontend → Backend

Chaque interaction utilisateur depuis le frontend React suit un parcours prévisible et unifié :

```text
[React Component]
       │
       │  window.__TAURI__.core.invoke("create_device", { token: "...", req: {...} })
       ▼
[src/commands/devices.rs]
       │
       │  1. Vérification du token de session via state.sessions.validate_session(&token)
       │  2. Appel de DeviceService::create_device(&state.pool, req)
       ▼
[src/services/device_service.rs]
       │
       │  3. Validation stricte : nom non vide, format IPv4/IPv6 ou hostname, ports 1..65535
       │  4. Appel de DeviceRepository::create(&state.pool, &req)
       ▼
[src/database/repositories/device_repository.rs]
       │
       │  5. Exécution de la requête paramétrée : INSERT INTO devices (...) VALUES (?1, ?2, ...)
       │  6. Récupération de l'identifiant inséré (last_insert_rowid)
       ▼
[Retour au Frontend]
       │  Conversion en DeviceDto (JSON sérialisé par Serde)
       ▼
[React Promise resolve(deviceDto)]
```

En cas d'erreur à n'importe quelle étape, une variante typée de `AppError` est transformée automatiquement par Serde en objet JSON `{ "code": "VALIDATION_ERROR", "message": "..." }`, ce qui rejette la `Promise` côté React avec un message d'erreur clair et exploitable.

---

## 4. Architecture d'Authentification

L'authentification est conçue pour une application desktop sécurisée en réseau d'entreprise sans recourir inutilement à des serveurs OAuth distants.

```text
Première exécution (users.count == 0)
        │
        ├─► is_bootstrap_required() retourne true
        │
        └─► create_first_user("admin", "MonMotDePasseFort123#")
                   │
                   ├── Validation de complexité (>= 8 car.)
                   ├── Génération d'un sel cryptographique (OsRng)
                   ├── Hachage Argon2id ($argon2id$v=19$m=19456...)
                   ├── Stockage dans SQLite
                   └── Création d'une session en mémoire -> token retourné

Exécutions suivantes (users.count >= 1)
        │
        ├─► is_bootstrap_required() retourne false
        ├─► create_first_user() -> REJETÉ IRRÉVERSIBLEMENT (BootstrapAlreadyCompleted)
        │
        └─► login("admin", "MonMotDePasseFort123#")
                   │
                   ├── Recherche du hash dans SQLite
                   ├── Vérification Argon2id à temps constant
                   └── Génération d'un token UUID v4 en mémoire (durée de validité : 8h)
```

### Caractéristiques de Sécurité :
1. **Argon2id** : Protection de référence contre les attaques par dictionnaire et attaques matérielles GPU/ASIC.
2. **Aucun mot de passe ni hash en clair** : La structure `UserDto` envoyée à React ne contient jamais le champ `password_hash`.
3. **Session en mémoire** : Les tokens sont stockés dans un `HashMap` protégé par un `tokio::sync::RwLock` en mémoire vive. Aucun secret persistant n'est écrit sur le disque dur.

---

## 5. Architecture SQLite

La base de données locale utilise le moteur embarqué SQLite via le pilote asynchrone `sqlx` en mode **WAL** (Write-Ahead Logging), permettant des lectures concurrentes sans blocage.

### Schéma Relationnel

```text
┌──────────────────────────┐            ┌──────────────────────────────────┐
│          users           │            │             devices              │
├──────────────────────────┤            ├──────────────────────────────────┤
│ id (PK, AUTOINCREMENT)   │            │ id (PK, AUTOINCREMENT)           │
│ username (TEXT, UNIQUE)  │            │ name (TEXT)                      │
│ password_hash (TEXT)     │            │ ip_address (TEXT)                │
│ is_active (INTEGER)      │            │ description (TEXT, NULL)         │
│ created_at (TEXT)        │            │ enabled (INTEGER)                │
│ updated_at (TEXT)        │            │ services_config (TEXT JSON)      │
└──────────────────────────┘            │ created_at (TEXT)                │
                                        │ updated_at (TEXT)                │
                                        └────────────────┬─────────────────┘
                                                         │ 1
                                                         │
                                                         │ N (ON DELETE CASCADE)
                                                         ▼
┌──────────────────────────┐            ┌──────────────────────────────────┐
│         settings         │            │        diagnostic_history        │
├──────────────────────────┤            ├──────────────────────────────────┤
│ id (PK, CHECK id = 1)    │            │ id (PK, AUTOINCREMENT)           │
│ scan_interval_secs (INT) │            │ device_id (FK -> devices.id)     │
│ network_timeout_ms (INT) │            │ overall_status (TEXT)            │
│ max_concurrent_tests(INT)│            │ l3_success (INTEGER)             │
│ startup_scan (INTEGER)   │            │ l3_latency_ms (REAL, NULL)       │
│ updated_at (TEXT)        │            │ l3_error (TEXT, NULL)            │
└──────────────────────────┘            │ l7_summary (TEXT JSON)           │
                                        │ executed_at (TEXT)               │
                                        └──────────────────────────────────┘
```

### Indexes de Performance :
- `idx_users_username` sur `users(username)`
- `idx_devices_ip_address` sur `devices(ip_address)`
- `idx_diag_hist_device_id` sur `diagnostic_history(device_id)`
- `idx_diag_hist_executed_at` sur `diagnostic_history(executed_at)`

---

## 6. Architecture Réseau (L3 & L7)

Le moteur réseau est scindé en trois sondes indépendantes :

### 1. Sonde ICMP (Layer 3 — Connectivité IP)
- **Windows** : Utilise l'API système Win32 `IcmpSendEcho` via la crate `winping`. Cette méthode est la seule sous Windows permettant d'émettre de vrais paquets ICMP Echo Request **sans exiger que l'utilisateur lance l'application en tant qu'Administrateur** (les raw sockets Windows `SOCK_RAW` étant bloqués aux utilisateurs standards).
- **Non-Windows (Linux/macOS)** : Fallback sur le binaire système `ping` avec extraction automatique de la latence RTT.
- **Résultat** : Mesure du RTT en millisecondes ou remontée précise de l'erreur (`Request timed out`, `Destination host unreachable`, etc.).

### 2. Sonde TCP (Layer 7 — Disponibilité de Port)
- Utilise `tokio::net::TcpStream::connect` encapsulé dans un `tokio::time::timeout`.
- Tente une véritable poignée de main TCP en 3 étapes (SYN -> SYN-ACK -> ACK).
- Distingue clairement :
  - **Port ouvert** : Connexion acceptée, latence calculée.
  - **Port fermé** : Rejet immédiat par paquet TCP RST (`Connection refused`).
  - **Machine injoignable ou filtrée** : Paquets SYN ignorés -> expiration du timeout.

### 3. Sonde HTTP / HTTPS (Layer 7 — Disponibilité Applicative)
- Utilise `reqwest::Client` avec support TLS natif (`rustls-tls`).
- Émet une vraie requête HTTP `GET` avec timeout configurable.
- **Distinction cruciale documentée** :
  - Une machine peut être joignable au niveau IP (L3 OK) et avoir son port 80 ouvert (TCP OK), mais renvoyer une erreur `500 Internal Server Error` ou `503 Service Unavailable`.
  - La sonde inspecte le code HTTP : un statut `2xx` ou `3xx` qualifie le service de fonctionnel, tandis qu'un code d'erreur applicatif ou serveur qualifie le test d'échec avec diagnostic détaillé.

### 4. Agrégation du Diagnostic Global (`DiagnosticResult`)
La règle de synthèse applique la logique suivante :

```text
┌─────────────────┬─────────────────┬──────────────────────┐
│  Statut L3 Ping │  Statuts L7     │  Statut Global       │
├─────────────────┼─────────────────┼──────────────────────┤
│  Échec (Down)   │  Non pertinent  │  Offline             │
│  Succès (Up)    │  Tous OK        │  Operational (Vert)  │
│  Succès (Up)    │  Au moins 1 HS  │  Degraded (Orange)   │
└─────────────────┴─────────────────┴──────────────────────┘
```

---

## 7. Commandes Tauri Disponibles

Toutes ces commandes sont enregistrées dans le gestionnaire IPC de Tauri et consommables via `invoke(cmd, args)` :

| Commande | Rôle | Paramètres d'Entrée | Type de Retour | Erreurs Possibles | Service Interne |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `is_bootstrap_required` | Vérifie si la base est vierge | Aucun | `bool` | `DATABASE_ERROR` | `AuthService` |
| `create_first_user` | Crée l'administrateur initial | `req: { username, password }` | `AuthResponse` | `BOOTSTRAP_ALREADY_COMPLETED`, `VALIDATION_ERROR` | `AuthService` |
| `login` | Authentifie un utilisateur | `req: { username, password }` | `AuthResponse` | `AUTH_ERROR`, `VALIDATION_ERROR` | `AuthService` |
| `logout` | Invalide une session | `token: string` | `void` | Aucun | `AuthService` |
| `get_current_user` | Profil de l'utilisateur actif | `token: string` | `UserDto` | `UNAUTHORIZED`, `NOT_FOUND` | `AuthService` |
| `change_password` | Modifie le mot de passe | `token: string`, `req: { current_password, new_password }` | `void` | `UNAUTHORIZED`, `AUTH_ERROR`, `VALIDATION_ERROR` | `AuthService` |
| `create_device` | Enregistre un équipement | `token: string`, `req: CreateDeviceRequest` | `DeviceDto` | `UNAUTHORIZED`, `VALIDATION_ERROR`, `DATABASE_ERROR` | `DeviceService` |
| `get_devices` | Liste tous les équipements | `token: string` | `DeviceDto[]` | `UNAUTHORIZED`, `DATABASE_ERROR` | `DeviceService` |
| `get_device` | Détail d'un équipement | `token: string`, `id: number` | `DeviceDto` | `UNAUTHORIZED`, `NOT_FOUND` | `DeviceService` |
| `update_device` | Modifie un équipement | `token: string`, `id: number`, `req: UpdateDeviceRequest` | `DeviceDto` | `UNAUTHORIZED`, `NOT_FOUND`, `VALIDATION_ERROR` | `DeviceService` |
| `delete_device` | Supprime un équipement | `token: string`, `id: number` | `void` | `UNAUTHORIZED`, `NOT_FOUND` | `DeviceService` |
| `run_ping` | Exécute un test ICMP immédiat | `target: string`, `timeout_ms?: number` | `PingResult` | `VALIDATION_ERROR` | `DiagnosticService` |
| `run_tcp_test` | Exécute un test TCP immédiat | `host: string`, `port: number`, `timeout_ms?: number` | `TcpTestResult` | `VALIDATION_ERROR` | `DiagnosticService` |
| `run_http_test` | Exécute un test HTTP immédiat | `url: string`, `timeout_ms?: number` | `HttpTestResult` | `VALIDATION_ERROR` | `DiagnosticService` |
| `run_device_diagnostic` | Diagnostic complet d'un équipement | `token: string`, `device_id: number` | `DiagnosticResult` | `UNAUTHORIZED`, `NOT_FOUND` | `DiagnosticService` |
| `get_network_overview` | Scan parallèle de tout le parc | `token: string` | `NetworkOverview` | `UNAUTHORIZED`, `DATABASE_ERROR` | `DiagnosticService` |
| `get_device_history` | Historique des mesures | `token: string`, `device_id: number`, `limit?: number` | `DiagnosticHistoryRecord[]` | `UNAUTHORIZED`, `DATABASE_ERROR` | `DiagnosticService` |
| `get_settings` | Récupère la configuration | `token: string` | `SettingsDto` | `UNAUTHORIZED`, `DATABASE_ERROR` | `SettingsService` |
| `update_settings` | Modifie la configuration | `token: string`, `req: UpdateSettingsRequest` | `SettingsDto` | `UNAUTHORIZED`, `VALIDATION_ERROR` | `SettingsService` |

---

## 8. Dépendances Rust & Justifications

Chaque crate dans `src-tauri/Cargo.toml` a une utilité précise et documentée :

| Crate | Version | Rôle dans le projet | Justification technique |
| :--- | :--- | :--- | :--- |
| `tauri` | 2.x | Framework d'application desktop | Fournit l'environnement d'exécution natif, le runtime d'IPC et l'interfaçage système |
| `tokio` | 1.x | Runtime asynchrone | Gestion non bloquante des I/O réseau (TCP, timeouts, tâches concurrentes, sémaphores) |
| `sqlx` | 0.8.x | Pilote asynchrone SQLite | Pool de connexions natif Tokio, requêtes SQL paramétrées contre l'injection |
| `argon2` | 0.5.x | Hachage sécurisé de mot de passe | Algorithme standard industriel résistant aux attaques par GPU et tables arc-en-ciel |
| `rand` | 0.8.x | Générateur aléatoire cryptographique | Génération de sel unique par utilisateur pour Argon2id |
| `winping` | 0.10.x | Sonde ICMP native sous Windows | Permet d'envoyer de vrais paquets ICMP sans droits Administrateur via l'API Windows `iphlpapi.dll` |
| `reqwest` | 0.12.x | Client HTTP/HTTPS asynchrone | Exécution des requêtes applicatives L7 avec parsing des codes de réponse et TLS (`rustls`) |
| `serde` & `serde_json` | 1.x | Sérialisation / Désérialisation | Conversion transparente des structures Rust vers les objets JSON reçus/envoyés par React |
| `chrono` | 0.4.x | Horodatage et durées UTC | Gestion des dates de création/mise à jour et timestamps des mesures de diagnostic |
| `uuid` | 1.x | Identifiants uniques | Génération de tokens de session cryptographiquement sûrs (UUID v4) |
| `thiserror` | 2.x | Définition des erreurs typées | Simplification de la hiérarchie des erreurs Rust et conversion en payloads de transport |
| `url` | 2.x | Validation syntaxique d'URL | Analyse stricte des adresses HTTP/HTTPS avant émission réseau |

---

## 9. Procédures d'Évolution du Code

### Procédure A : Ajouter une nouvelle commande Tauri
1. **Service** : Écrire la fonction métier dans le service approprié (`src-tauri/src/services/`).
2. **Command** : Créer la fonction annotée avec `#[tauri::command]` dans le module adéquat (`src-tauri/src/commands/`).
3. **Export** : S'assurer que le module la réexporte dans `src-tauri/src/commands/mod.rs`.
4. **Enregistrement** : Ajouter le nom de la fonction dans la macro `invoke_handler(tauri::generate_handler![...])` dans `src-tauri/src/lib.rs`.

### Procédure B : Ajouter un nouveau champ à `Device`
1. **Modèle** (`src-tauri/src/models/device.rs`) :
   - Ajouter le champ dans `Device` (pour SQLite) et dans `DeviceDto` (pour React).
   - Adapter la méthode `to_dto()`, `CreateDeviceRequest` et `UpdateDeviceRequest`.
2. **Migration** (`src-tauri/src/database/migrations.rs`) :
   - Ajouter une clause `ALTER TABLE devices ADD COLUMN mon_champ TYPE ...;` ou adapter le `CREATE TABLE`.
3. **Repository** (`src-tauri/src/database/repositories/device_repository.rs`) :
   - Intégrer le nouveau champ dans les requêtes `SELECT`, `INSERT` et `UPDATE` paramétrées.
4. **Service & Validation** (`src-tauri/src/services/device_service.rs`) :
   - Ajouter la validation du champ si nécessaire.
5. **Tests** (`src-tauri/tests/backend_tests.rs`) :
   - Mettre à jour les tests CRUD pour vérifier la persistance du champ.

### Procédure C : Ajouter un nouveau type de sonde L7 (ex: DNS, SNMP)
1. **Modèle** : Ajouter le type dans l'enum `ServiceType` (`src-tauri/src/models/device.rs`).
2. **Driver Réseau** : Créer un nouveau module dans `src-tauri/src/network/` (ex: `dns.rs`).
3. **Diagnostic Service** : Mettre à jour la méthode `probe_service` dans `diagnostic_service.rs` pour router vers le nouveau driver.

---

## 10. Commandes de Validation et Lancement

Toutes les commandes s'exécutent depuis le répertoire `src-tauri/` (ou avec `--manifest-path src-tauri/Cargo.toml`) :

```powershell
# Vérification de la compilation
cargo check

# Exécution de la suite complète de tests réels
cargo test

# Analyse statique et linter strict (zéro warning)
cargo clippy -- -D warnings

# Vérification du formatage du code
cargo fmt --check

# Lancement de l'environnement de développement Tauri
npm run tauri dev
```

---

## 11. Procédure de Test sur Réseau Local

Pour valider le backend dans des conditions réelles (Wi-Fi domestique ou laboratoire d'essai ASECNA) sans données fictives :

1. **Bootstrap** : Appeler `create_first_user` avec vos identifiants pour déverrouiller la base.
2. **Équipement 1 (Routeur local)** :
   - IP : `192.168.1.1`
   - Services : Web Admin (`Http` sur port 80), SSH (`Tcp` sur port 22).
   - Résultat attendu : Ping OK, Web Admin OK -> **Operational** (ou **Degraded** si SSH est fermé).
3. **Équipement 2 (PC de bureau / Téléphone)** :
   - IP : `192.168.1.50`
   - Services : Aucun.
   - Résultat attendu : Ping OK -> **Operational**.
4. **Équipement 3 (Adresse inexistante)** :
   - IP : `192.168.1.249`
   - Services : Port 8080.
   - Résultat attendu : Ping Timeout -> **Offline**.

---

## 12. Sécurité

- **Protection contre les injections SQL** : Toutes les requêtes sans exception utilisent le binding de paramètres (`?1, ?2, ...`). Aucune concaténation de chaînes SQL n'existe dans le codebase.
- **Protection des mots de passe** : Hachage Argon2id avec sel cryptographique aléatoire de 128 bits. Les mots de passe en clair ne sont jamais journalisés ni conservés.
- **Validation en profondeur** : Même si le futur frontend React implémente ses propres formulaires, le backend valide chaque champ (longueur de chaîne, plage de ports, format IP/URL).
- **Gestion des erreurs étanche** : Les détails internes (chemins de fichiers, messages de panique) ne sont pas transmis au client afin d'éviter la fuite d'informations système.

---

## 13. Justification des Décisions Architecturales

1. **Pourquoi Tauri Commands plutôt qu'une API REST locale ?**
   - Élimine le besoin d'ouvrir un port réseau local TCP (`localhost:8000`) sur la machine de l'utilisateur, ce qui évite les conflits de ports, les alertes de pare-feu Windows Defender et les risques de requêtes Cross-Origin malveillantes depuis un navigateur web.
2. **Pourquoi SQLite en mode WAL ?**
   - Offre une persistance ACID sans dépendance externe à installer (aucun service PostgreSQL ou MySQL requis), avec une latence d'écriture négligeable et une concurrence fluide.
3. **Pourquoi la séparation Command / Service / Repository ?**
   - Assure une testabilité unitaire totale (la logique métier peut être testée en mémoire sans Tauri) et simplifie la maintenance à long terme pour les futurs contributeurs.
4. **Pourquoi `winping` pour ICMP sous Windows ?**
   - Sous Windows, les applications ordinaires ne disposent pas des privilèges administrateur pour instancier des raw sockets `AF_INET / SOCK_RAW`. `winping` exploite l'API officielle Windows `IcmpSendEcho` (`iphlpapi.dll`), assurant un ping ICMP réel sans nécessiter d'élévation de privilèges UAC.
