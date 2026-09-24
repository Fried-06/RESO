# Diagrammes UML — ASECNA Network Monitor

> Diagrammes générés à partir du code source réel du projet (MVP).
> Application desktop de supervision réseau basée sur **Tauri 2 + Rust** (backend) et **React + TypeScript** (frontend), avec persistance **SQLite**.

---

## 1. Diagramme de cas d'utilisation

### Objectif
Représenter les acteurs et les fonctionnalités réellement exposées par l'application au travers des commandes Tauri enregistrées dans `lib.rs`.

### PlantUML

```plantuml
@startuml
left to right direction
skinparam packageStyle rectangle
skinparam actorStyle awesome

actor "Technicien réseau\n(Utilisateur)" as User
actor "Administrateur\n(Premier lancement)" as Admin

rectangle "ASECNA Network Monitor" {

  package "Authentification" {
    usecase "Créer le premier compte\n(Bootstrap)" as UC_Bootstrap
    usecase "Se connecter (Login)" as UC_Login
    usecase "Se déconnecter (Logout)" as UC_Logout
    usecase "Consulter son profil" as UC_Profile
    usecase "Changer son mot de passe" as UC_ChgPwd
  }

  package "Gestion des équipements" {
    usecase "Lister les équipements" as UC_ListDev
    usecase "Ajouter un équipement" as UC_AddDev
    usecase "Modifier un équipement" as UC_EditDev
    usecase "Supprimer un équipement" as UC_DelDev
  }

  package "Supervision & Diagnostics" {
    usecase "Vue d'ensemble réseau\n(Dashboard)" as UC_Overview
    usecase "Diagnostic complet\nd'un équipement" as UC_DevDiag
    usecase "Test ICMP/Ping ad hoc" as UC_Ping
    usecase "Test TCP ad hoc" as UC_Tcp
    usecase "Test HTTP/HTTPS ad hoc" as UC_Http
    usecase "Consulter l'historique\nd'un équipement" as UC_History
  }

  package "Paramètres" {
    usecase "Consulter les paramètres" as UC_GetSettings
    usecase "Modifier les paramètres" as UC_UpdSettings
  }
}

Admin --> UC_Bootstrap

User --> UC_Login
User --> UC_Logout
User --> UC_Profile
User --> UC_ChgPwd

User --> UC_ListDev
User --> UC_AddDev
User --> UC_EditDev
User --> UC_DelDev

User --> UC_Overview
User --> UC_DevDiag
User --> UC_Ping
User --> UC_Tcp
User --> UC_Http
User --> UC_History

User --> UC_GetSettings
User --> UC_UpdSettings

UC_DevDiag .> UC_Ping : <<include>>
UC_DevDiag .> UC_Tcp : <<include>>
UC_DevDiag .> UC_Http : <<include>>
UC_Overview .> UC_DevDiag : <<include>>

@enduml
```

### Description
- **Admin** est l'acteur du premier lancement uniquement : il crée le compte initial via `create_first_user` quand la base SQLite est vide (`is_bootstrap_required`).
- **Technicien réseau** accède à toutes les fonctionnalités après authentification.
- Le diagnostic complet (`run_device_diagnostic`) inclut systématiquement un ping ICMP (L3) et des sondes de services L7 (TCP/HTTP/HTTPS).
- La vue d'ensemble (`get_network_overview`) lance des diagnostics concurrents sur tous les équipements activés.

---

## 2. Diagramme de composants / architecture

### Objectif
Représenter la décomposition modulaire réelle de l'application : couche React, pont Tauri IPC, modules Rust (commands, services, repositories, network, state), et SQLite.

### PlantUML

```plantuml
@startuml
skinparam componentStyle rectangle
skinparam backgroundColor #FAFAFA
skinparam component {
  BorderColor #555555
  BackgroundColor #EEF3FF
}

package "Poste utilisateur (Desktop)" {

  package "Frontend — React + TypeScript" {
    [App.tsx\n(Routage par onglets)] as App
    [AuthContext\n(Gestion session)] as AuthCtx
    [ThemeContext] as ThemeCtx

    package "Pages" {
      [AuthPage] as PAuth
      [OverviewPage] as POverview
      [DevicesPage] as PDevices
      [DiagnosticsPage] as PDiag
      [SettingsPage] as PSettings
    }

    package "services/tauri/" {
      [auth.ts] as SAuth
      [devices.ts] as SDevices
      [diagnostics.ts] as SDiag
      [settings.ts] as SSettings
      [client.ts\n(tauriInvoke)] as SClient
    }

    package "types/" {
      [auth.ts, device.ts\ndiagnostic.ts, settings.ts] as Types
    }
  }

  interface "Tauri IPC\n(invoke)" as IPC

  package "Backend — Tauri + Rust" {

    package "commands/" {
      [auth.rs] as CAuth
      [devices.rs] as CDevices
      [diagnostics.rs] as CDiag
      [settings.rs] as CSettings
    }

    package "services/" {
      [AuthService] as SVAuth
      [DeviceService] as SVDevice
      [DiagnosticService] as SVDiag
      [SettingsService] as SVSettings
    }

    package "network/" {
      [icmp.rs\n(ping_target)] as Nicmp
      [tcp.rs\n(test_tcp_connection)] as Ntcp
      [http.rs\n(test_http_endpoint)] as Nhttp
    }

    package "database/" {
      package "repositories/" {
        [UserRepository] as RUser
        [DeviceRepository] as RDevice
        [SettingsRepository] as RSettings
      }
      [connection.rs\n(SqlitePool)] as DBConn
      [migrations.rs] as DBMig
    }

    package "state/" {
      [AppState\n(pool + sessions + http_client)] as State
      [SessionManager\n(in-memory RwLock)] as Sessions
    }

    package "models/" {
      [user.rs, device.rs\ndiagnostic.rs, settings.rs] as Models
    }

    [error.rs\n(AppError)] as Errors
  }

  database "SQLite\nasecna_monitor.db" as DB {
    [users]
    [devices]
    [settings]
    [diagnostic_history]
  }

  component "Réseau supervisé\n(Équipements IP)" as Network
}

SClient --> IPC : invoke()
SAuth --> SClient
SDevices --> SClient
SDiag --> SClient
SSettings --> SClient

App --> AuthCtx
App --> PAuth
App --> POverview
App --> PDevices
App --> PDiag
App --> PSettings

PAuth --> SAuth
POverview --> SDiag
PDevices --> SDevices
PDiag --> SDiag
PSettings --> SSettings

IPC --> CAuth
IPC --> CDevices
IPC --> CDiag
IPC --> CSettings

CAuth --> State
CDevices --> State
CDiag --> State
CSettings --> State

CAuth --> SVAuth
CDevices --> SVDevice
CDiag --> SVDiag
CSettings --> SVSettings

SVAuth --> RUser
SVDevice --> RDevice
SVDiag --> RDevice
SVDiag --> RSettings
SVSettings --> RSettings

SVDiag --> Nicmp
SVDiag --> Ntcp
SVDiag --> Nhttp

RUser --> DBConn
RDevice --> DBConn
RSettings --> DBConn
DBConn --> DB
DBMig --> DB

State --> Sessions
State --> DBConn

Nicmp --> Network : ICMP Echo
Ntcp --> Network : TCP Handshake
Nhttp --> Network : HTTP/HTTPS GET

@enduml
```

### Description
- `client.ts` est le point d'entrée unique de toute communication frontend → backend via `invoke()`.
- `AppState` est injecté dans chaque commande par Tauri via `State<'_, AppState>` ; il regroupe le pool SQLite, le `SessionManager` en mémoire, et le client HTTP `reqwest`.
- Les repositories accèdent directement au pool SQLite via `sqlx`.
- Le module `network/` effectue de vraies sondes réseau : `winping` (Windows IcmpSendEcho) pour ICMP, `TcpStream::connect` pour TCP, `reqwest` pour HTTP/HTTPS.

---

## 3. Diagramme de classes

### Objectif
Représenter les structures/types réellement définis dans les modules `models/` et `state/` du backend Rust, ainsi que leurs relations.

### PlantUML

```plantuml
@startuml
skinparam classAttributeIconSize 0
skinparam class {
  BackgroundColor #EEF3FF
  BorderColor #3355AA
}

class User {
  +id: i64
  +username: String
  +password_hash: String
  +is_active: i64
  +created_at: String
  +updated_at: String
}

class UserDto {
  +id: i64
  +username: String
  +is_active: bool
  +created_at: String
  +updated_at: String
}

class AuthResponse {
  +token: String
  +user: UserDto
  +expires_at: DateTime<Utc>
}

class LoginRequest {
  +username: String
  +password: String
}

class CreateFirstUserRequest {
  +username: String
  +password: String
}

class ChangePasswordRequest {
  +current_password: String
  +new_password: String
}

class SessionInfo {
  +user_id: i64
  +username: String
  +created_at: DateTime<Utc>
  +last_active_at: DateTime<Utc>
  +expires_at: DateTime<Utc>
}

class SessionManager {
  -sessions: RwLock<HashMap<String, SessionInfo>>
  -session_timeout: Duration
  +new(timeout_hours: i64): Self
  +create_session(user_id, username): (String, DateTime)
  +validate_session(token): Result<SessionInfo>
  +invalidate_session(token): void
}

class AppState {
  +pool: SqlitePool
  +sessions: Arc<SessionManager>
  +http_client: reqwest::Client
  +new(pool): Self
}

enum ServiceType {
  Tcp
  Http
  Https
}

class ServiceConfig {
  +name: String
  +service_type: ServiceType
  +port: u16
  +target: Option<String>
}

class Device {
  +id: i64
  +name: String
  +ip_address: String
  +description: Option<String>
  +enabled: i64
  +services_config: String
  +created_at: String
  +updated_at: String
  +to_dto(): DeviceDto
}

class DeviceDto {
  +id: i64
  +name: String
  +ip_address: String
  +description: Option<String>
  +enabled: bool
  +services: Vec<ServiceConfig>
  +created_at: String
  +updated_at: String
}

class CreateDeviceRequest {
  +name: String
  +ip_address: String
  +description: Option<String>
  +enabled: bool
  +services: Vec<ServiceConfig>
}

class UpdateDeviceRequest {
  +name: Option<String>
  +ip_address: Option<String>
  +description: Option<String>
  +enabled: Option<bool>
  +services: Option<Vec<ServiceConfig>>
}

enum DeviceStatus {
  Operational
  Degraded
  Offline
}

class PingResult {
  +target: String
  +success: bool
  +latency_ms: Option<f64>
  +error: Option<String>
}

class TcpTestResult {
  +host: String
  +port: u16
  +success: bool
  +latency_ms: Option<f64>
  +error: Option<String>
}

class HttpTestResult {
  +url: String
  +status_code: Option<u16>
  +success: bool
  +latency_ms: Option<f64>
  +error: Option<String>
}

class ServiceProbeResult {
  +name: String
  +service_type: String
  +port: u16
  +success: bool
  +latency_ms: Option<f64>
  +status_code: Option<u16>
  +error: Option<String>
}

class DiagnosticResult {
  +device_id: i64
  +device_name: String
  +ip_address: String
  +l3_result: PingResult
  +l7_results: Vec<ServiceProbeResult>
  +overall_status: DeviceStatus
  +executed_at: DateTime<Utc>
}

class NetworkOverview {
  +total_devices: usize
  +online_devices: usize
  +degraded_devices: usize
  +offline_devices: usize
  +scanned_at: DateTime<Utc>
  +results: Vec<DiagnosticResult>
}

class DiagnosticHistoryRecord {
  +id: i64
  +device_id: i64
  +overall_status: String
  +l3_success: i64
  +l3_latency_ms: Option<f64>
  +l3_error: Option<String>
  +l7_summary: String
  +executed_at: String
}

class AppSettings {
  +id: i64
  +scan_interval_secs: i64
  +network_timeout_ms: i64
  +max_concurrent_tests: i64
  +startup_scan: i64
  +updated_at: String
}

class SettingsDto {
  +scan_interval_secs: u64
  +network_timeout_ms: u64
  +max_concurrent_tests: usize
  +startup_scan: bool
  +updated_at: String
}

User ..> UserDto : <<from>>
AuthResponse "1" *-- "1" UserDto

AppState "1" *-- "1" SessionManager
SessionManager "1" *-- "0..*" SessionInfo

Device ..> DeviceDto : to_dto()
DeviceDto "1" *-- "0..*" ServiceConfig
ServiceConfig --> ServiceType
CreateDeviceRequest "1" *-- "0..*" ServiceConfig

DiagnosticResult "1" *-- "1" PingResult : l3_result
DiagnosticResult "1" *-- "0..*" ServiceProbeResult : l7_results
DiagnosticResult --> DeviceStatus : overall_status
NetworkOverview "1" *-- "0..*" DiagnosticResult

DiagnosticHistoryRecord --> Device : device_id (FK)

AppSettings ..> SettingsDto : <<from>>

@enduml
```

### Description
- `User` (entité SQLite) et `UserDto` (DTO envoyé au frontend) sont explicitement séparés — `password_hash` n'est jamais sérialisé.
- `Device.services_config` est stocké en JSON dans SQLite et désérialisé en `Vec<ServiceConfig>` lors de la conversion `to_dto()`.
- `AppState` est l'état global partagé par toutes les commandes Tauri via `State<'_, AppState>`.
- `SessionManager` utilise un `RwLock<HashMap>` en mémoire : les sessions ne survivent pas à un redémarrage.
- `DiagnosticResult` agrège le résultat L3 (`PingResult`) et les résultats L7 (`Vec<ServiceProbeResult>`).

---

## 4. Diagramme de séquence — Authentification (Login)

### Objectif
Tracer le chemin réel du login depuis le formulaire React jusqu'à la création de session en mémoire Rust, en passant par Argon2id.

### PlantUML

```plantuml
@startuml
skinparam sequenceMessageAlign center
skinparam backgroundColor #FAFAFA

actor "Technicien\nréseau" as User
participant "AuthPage\n(React)" as UI
participant "AuthContext\n(React)" as Ctx
participant "auth.ts\n(tauriInvoke)" as FESvc
participant "Tauri IPC\n(invoke)" as IPC
participant "auth.rs\n(Command)" as Cmd
participant "AuthService\n(Rust)" as Svc
participant "UserRepository\n(Rust)" as Repo
database "SQLite\nasecna_monitor.db" as DB
participant "SessionManager\n(in-memory)" as SM

== Initialisation ==
UI -> FESvc : isBootstrapRequired()
FESvc -> IPC : invoke("is_bootstrap_required")
IPC -> Cmd : is_bootstrap_required(state)
Cmd -> Svc : AuthService::is_bootstrap_required(&pool)
Svc -> Repo : UserRepository::count(pool)
Repo -> DB : SELECT COUNT(*) FROM users
DB --> Repo : count = N
Repo --> Svc : N
Svc --> Cmd : false (users exist)
Cmd --> IPC : Ok(false)
IPC --> FESvc : false
FESvc --> UI : bootstrapRequired = false

== Saisie et envoi des identifiants ==
User -> UI : Saisit username + password
User -> UI : Clique "Se connecter"
UI -> Ctx : login({ username, password })
Ctx -> FESvc : login(req: LoginRequest)
FESvc -> IPC : invoke("login", { req })
IPC -> Cmd : login(state, req)

== Traitement backend ==
Cmd -> Svc : AuthService::login(&pool, &sessions, req)
Svc -> Repo : UserRepository::find_by_username(pool, username)
Repo -> DB : SELECT * FROM users WHERE username = ?
DB --> Repo : User row
Repo --> Svc : Some(User)

alt Utilisateur inactif
  Svc --> Cmd : Err(AppError::Auth("User account is disabled"))
  Cmd --> IPC : Err
  IPC --> FESvc : Err
  FESvc --> Ctx : throw Error
  Ctx --> UI : Affiche message d'erreur
else Utilisateur actif
  Svc -> Svc : verify_password(password, user.password_hash)\n[Argon2id]
  alt Mot de passe incorrect
    Svc --> Cmd : Err(AppError::Auth("Invalid username or password"))
    Cmd --> IPC : Err
    IPC --> FESvc : Err
    FESvc --> Ctx : throw Error
    Ctx --> UI : Affiche message d'erreur
  else Mot de passe valide
    Svc -> SM : create_session(user.id, username)
    SM -> SM : Génère UUID v4 (token)\nDéfinit expires_at = now + 8h
    SM --> Svc : (token, expires_at)
    Svc --> Cmd : Ok(AuthResponse { token, UserDto, expires_at })
    Cmd --> IPC : Ok(AuthResponse)
    IPC --> FESvc : AuthResponse
    FESvc --> Ctx : AuthResponse
    Ctx -> Ctx : localStorage.setItem("asecna_session_token", token)
    Ctx -> Ctx : setUser(res.user), setToken(res.token)
    Ctx --> UI : user défini -> redirect vers MainContent
    UI --> User : Dashboard affiché
  end
end

@enduml
```

### Description
- La vérification de bootstrap est effectuée **à chaque démarrage** : si la table `users` est vide, le formulaire de création du premier compte s'affiche.
- La vérification du mot de passe est réalisée par **Argon2id** (`AuthService::verify_password`), sans jamais transmettre le hash au frontend.
- Le token de session est un **UUID v4** stocké en `localStorage` côté React et dans un `HashMap<String, SessionInfo>` en mémoire Rust (non persisté en SQLite).
- La durée de session est de **8 heures** (définie dans `AppState::new`).

---

## 5. Diagramme de séquence — Diagnostic complet d'un équipement

### Objectif
Tracer le flux réel de `run_device_diagnostic` : du clic utilisateur jusqu'à la persistance en SQLite et le retour des résultats.

### PlantUML

```plantuml
@startuml
skinparam sequenceMessageAlign center
skinparam backgroundColor #FAFAFA

actor "Technicien\nréseau" as User
participant "DiagnosticsPage\n(React)" as UI
participant "diagnostics.ts\n(tauriInvoke)" as FESvc
participant "Tauri IPC\n(invoke)" as IPC
participant "diagnostics.rs\n(Command)" as Cmd
participant "SessionManager" as SM
participant "DiagnosticService\n(Rust)" as Svc
participant "DeviceRepository" as RDev
participant "SettingsRepository" as RSet
database "SQLite" as DB
participant "icmp.rs\n(ping_target)" as ICMP
participant "tcp.rs / http.rs\n(probe_service)" as L7
participant "Équipement\nsupervisé" as Target

== Lancement du diagnostic ==
User -> UI : Clique "Diagnostiquer" (device sélectionné)
UI -> FESvc : runDeviceDiagnostic(token, deviceId)
FESvc -> IPC : invoke("run_device_diagnostic", { token, deviceId })
IPC -> Cmd : run_device_diagnostic(state, token, device_id)

== Validation de session ==
Cmd -> SM : sessions.validate_session(&token)
alt Session invalide ou expirée
  SM --> Cmd : Err(AppError::Unauthorized)
  Cmd --> IPC : Err
  IPC --> FESvc : Err
  FESvc --> UI : throw Error -> affiche erreur
else Session valide
  SM --> Cmd : Ok(SessionInfo)

  == Récupération des données ==
  Cmd -> Svc : DiagnosticService::run_device_diagnostic(&pool, &http_client, device_id)
  Svc -> RDev : DeviceRepository::find_by_id(pool, device_id)
  RDev -> DB : SELECT * FROM devices WHERE id = ?
  DB --> RDev : Device row
  RDev --> Svc : Some(Device)
  Svc -> RSet : SettingsRepository::get(pool)
  RSet -> DB : SELECT * FROM settings WHERE id = 1
  DB --> RSet : AppSettings
  RSet --> Svc : AppSettings (timeout_ms, etc.)

  == Étape 1 : Sonde L3 ICMP ==
  Svc -> ICMP : ping_target(ip_address, timeout)
  ICMP -> Target : ICMP Echo Request
  Target --> ICMP : ICMP Echo Reply (ou timeout)
  ICMP --> Svc : PingResult { success, latency_ms }

  == Étape 2 : Sondes L7 (par service configuré) ==
  loop Pour chaque ServiceConfig dans services_config JSON
    alt ServiceType::Tcp
      Svc -> L7 : test_tcp_connection(ip, port, timeout)
      L7 -> Target : TCP SYN
      Target --> L7 : SYN-ACK (ou RST / timeout)
      L7 --> Svc : TcpTestResult
    else ServiceType::Http ou Https
      Svc -> L7 : test_http_endpoint(client, url, timeout)
      L7 -> Target : HTTP GET
      Target --> L7 : HTTP Response (2xx/3xx ou erreur)
      L7 --> Svc : HttpTestResult
    end
    Svc -> Svc : Convertit en ServiceProbeResult
  end

  == Étape 3 : Calcul du statut global ==
  Svc -> Svc : if !l3.success -> Offline\nelse if any l7 failed -> Degraded\nelse -> Operational

  == Étape 4 : Persistance historique ==
  Svc -> RDev : DeviceRepository::save_diagnostic(pool, device_id,\nstatus, l3_success, l3_latency, l3_error, l7_json)
  RDev -> DB : INSERT INTO diagnostic_history (...)
  DB --> RDev : OK

  == Retour des résultats ==
  Svc --> Cmd : Ok(DiagnosticResult)
  Cmd --> IPC : Ok(DiagnosticResult)
  IPC --> FESvc : DiagnosticResult
  FESvc --> UI : DiagnosticResult
  UI --> User : Affiche L3, L7, statut global
end

@enduml
```

### Description
- La validation de session est obligatoire : `state.sessions.validate_session(&token)` est appelée **avant** toute opération métier dans les commandes protégées.
- Le ping ICMP utilise `winping` (Windows IcmpSendEcho, sans droits admin) sur Windows, ou `ping -c 1` système sur Linux/macOS.
- Les services L7 sont lus depuis la colonne `services_config` (JSON) de la table `devices` et désérialisés dynamiquement.
- Le résultat complet est persisté en base (`diagnostic_history`) **avant** d'être retourné au frontend.

---

## 6. Diagramme d'activité — Processus de diagnostic

### Objectif
Représenter les étapes, branches et conditions du diagnostic réseau d'un équipement (logique de `execute_diagnostic_internal`).

### PlantUML

```plantuml
@startuml
skinparam activityBackgroundColor #EEF3FF
skinparam activityBorderColor #3355AA
skinparam activityDiamondBackgroundColor #FFFDE7
skinparam backgroundColor #FAFAFA

start

:Réception de la commande\nrun_device_diagnostic(token, device_id);

:Valider le token de session\n(SessionManager::validate_session);

if (Session valide ?) then (Non)
  :Retourner Err(Unauthorized);
  stop
else (Oui)
endif

:Récupérer le Device depuis SQLite\n(DeviceRepository::find_by_id);

if (Device trouvé ?) then (Non)
  :Retourner Err(NotFound);
  stop
else (Oui)
endif

:Récupérer les paramètres globaux\n(SettingsRepository::get)\n-> network_timeout_ms;

partition "Sonde L3 — ICMP" {
  :Exécuter ping_target(ip_address, timeout)\n[winping sur Windows, système sinon];
  :Mesurer latence (ms) et succès;
  :PingResult { success, latency_ms, error };
}

if (L3 ping réussi ?) then (Non)
  :Statut global = OFFLINE;
else (Oui)
  partition "Sondes L7 — Services" {
    :Désérialiser services_config JSON\nen Vec<ServiceConfig>;
    :Initialiser l7_results = [];

    while (Reste des services à tester ?) is (Oui)
      if (ServiceType ?) then (TCP)
        :test_tcp_connection(ip, port, timeout)\n[TcpStream::connect, mesure SYN-ACK];
      else (HTTP/HTTPS)
        :test_http_endpoint(client, url, timeout)\n[reqwest GET, succès si 2xx ou 3xx];
      endif
      :Créer ServiceProbeResult\n{ name, type, port, success, latency_ms };
      :Ajouter à l7_results;
    endwhile (Non)
  }

  if (Au moins un service L7 a échoué ?) then (Oui)
    :Statut global = DEGRADED;
  else (Non)
    :Statut global = OPERATIONAL;
  endif
endif

partition "Persistance SQLite" {
  :Sérialiser l7_results en JSON;
  :INSERT INTO diagnostic_history\n(device_id, overall_status, l3_success,\nl3_latency_ms, l3_error, l7_summary,\nexecuted_at = now());
}

:Construire DiagnosticResult\n{ device_id, device_name, ip_address,\nl3_result, l7_results, overall_status, executed_at };

:Retourner Ok(DiagnosticResult)\nau frontend via IPC;

stop

@enduml
```

### Description
- La logique de statut est **strictement hiérarchique** : L3 prime sur L7. Si le ping échoue, le statut est `Offline` sans exécuter les sondes L7.
- Si L3 passe mais qu'au moins un service L7 échoue, le statut est `Degraded` (équipement partiellement disponible).
- `Operational` signifie que le ping ET tous les services L7 configurés répondent correctement.
- La persistance en base se fait toujours, qu'il y ait des services L7 ou non.

---

## 7. Diagramme de déploiement

### Objectif
Représenter l'environnement de déploiement réel : poste utilisateur unique, processus Tauri (frontend WebView + backend Rust), fichier SQLite local, et les équipements réseau supervisés.

### PlantUML

```plantuml
@startuml
skinparam nodeBackgroundColor #EEF3FF
skinparam nodeBorderColor #3355AA
skinparam databaseBackgroundColor #FFF9E6
skinparam backgroundColor #FAFAFA

node "Poste Technicien\n(Windows Desktop)" as Workstation {

  node "Processus Tauri\n(asecreso.exe)" as TauriApp {

    component "WebView2\n(Frontend React/TS)" as WebView {
      artifact "dist/ (HTML+JS+CSS compilés)" as Bundle
    }

    component "Backend Rust\n(Tauri Core)" as RustCore {
      component "invoke_handler\n(19 commandes enregistrées)" as Handler
      component "AppState\n(pool + sessions + http_client)" as AppStateComp
      component "SessionManager\n(in-memory, 8h TTL)" as SM
      component "Modules network/\n(icmp, tcp, http)" as NetMod
    }

    WebView --> RustCore : IPC via invoke()\n[Tauri bridge]
  }

  database "SQLite\nasecna_monitor.db\n(AppData local)" as SQLiteDB {
    artifact "Table: users"
    artifact "Table: devices"
    artifact "Table: settings"
    artifact "Table: diagnostic_history"
  }

  RustCore --> SQLiteDB : sqlx (async)\nread / write
}

cloud "Réseau IP supervisé\n(LAN / VLAN ASECNA)" as Network {
  node "Équipement 1\n(ex: Routeur)" as Dev1
  node "Équipement 2\n(ex: Serveur)" as Dev2
  node "Équipement N\n(ex: Switch, Imprimante)" as DevN
}

TauriApp --> Network : ICMP Echo Request (L3)\nTCP SYN (L7)\nHTTP/HTTPS GET (L7)

note right of SQLiteDB
  Fichier unique local.
  Chemin : app_data_dir/asecna_monitor.db
  Initialisé au premier lancement.
  Aucune connexion réseau requise
  pour la persistance.
end note

note right of Network
  Pas de serveur distant.
  Les sondes partent directement
  du poste technicien vers les
  équipements supervisés.
end note

@enduml
```

### Description
- L'application est **entièrement locale** : un seul poste, un seul processus, un seul fichier SQLite dans le répertoire `AppData` de l'utilisateur.
- Il n'y a **pas de serveur backend distant** : Tauri embarque le backend Rust dans le même exécutable que le frontend WebView2.
- Les sondes réseau (ICMP, TCP, HTTP) partent **directement** du poste technicien vers les équipements IP du réseau supervisé.
- `SessionManager` est en mémoire uniquement : les sessions ne survivent pas à un redémarrage de l'application.

---

## Références — Fichiers sources utilisés

| Diagramme | Fichiers sources principaux |
|-----------|----------------------------|
| 1. Cas d'utilisation | `src-tauri/src/lib.rs` (liste des 19 commandes `invoke_handler`) |
| 2. Composants / Architecture | `src/App.tsx`, `src/context/AuthContext.tsx`, `src/services/tauri/client.ts`, `src-tauri/src/lib.rs`, `src-tauri/src/state/app_state.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/network/mod.rs` |
| 3. Diagramme de classes | `src-tauri/src/models/user.rs`, `src-tauri/src/models/device.rs`, `src-tauri/src/models/diagnostic.rs`, `src-tauri/src/models/settings.rs`, `src-tauri/src/state/app_state.rs`, `src/types/device.ts`, `src/types/diagnostic.ts` |
| 4. Séquence — Authentification | `src/context/AuthContext.tsx`, `src/services/tauri/auth.ts`, `src-tauri/src/commands/auth.rs`, `src-tauri/src/services/auth_service.rs`, `src-tauri/src/database/repositories/user_repository.rs`, `src-tauri/src/state/app_state.rs` |
| 5. Séquence — Diagnostic | `src/services/tauri/diagnostics.ts`, `src-tauri/src/commands/diagnostics.rs`, `src-tauri/src/services/diagnostic_service.rs`, `src-tauri/src/network/icmp.rs`, `src-tauri/src/network/tcp.rs`, `src-tauri/src/network/http.rs`, `src-tauri/src/database/repositories/device_repository.rs` |
| 6. Activité — Diagnostic | `src-tauri/src/services/diagnostic_service.rs` (méthode `execute_diagnostic_internal`, logique de statut L3/L7) |
| 7. Déploiement | `src-tauri/src/lib.rs`, `src-tauri/src/state/app_state.rs`, `src-tauri/src/database/connection.rs`, `src-tauri/src/database/migrations.rs`, `src-tauri/tauri.conf.json` |
