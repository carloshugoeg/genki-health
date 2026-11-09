---- MODULE Session ----
\* Genki Health E2-P2-09 — client session + refresh-store state machine.
\* Reader words follow PORTS-TESTS C3.5 and locked Auth (Carlos 2026-10-19).
\* Bug* actions are wrong implementations; their paths should break the rules.

EXTENDS Integers

VARIABLES
  client,              \* "anonymous" | "authenticated" | "refresh_needed"
  refresh,             \* "none" | "active" | "revoked"
  accessLive,          \* TRUE while a previously issued access JWT has not expired
  userActive,          \* identity still activo
  refreshTimedOut,     \* stored refresh past exp
  logoutKilledAccess,  \* TRUE only under the wrong logout implementation
  tick

vars == <<client, refresh, accessLive, userActive, refreshTimedOut, logoutKilledAccess, tick>>

TypeOK ==
  /\ client \in {"anonymous", "authenticated", "refresh_needed"}
  /\ refresh \in {"none", "active", "revoked"}
  /\ accessLive \in BOOLEAN
  /\ userActive \in BOOLEAN
  /\ refreshTimedOut \in BOOLEAN
  /\ logoutKilledAccess \in BOOLEAN
  /\ tick \in 0..8

Init ==
  /\ client = "anonymous"
  /\ refresh = "none"
  /\ accessLive = FALSE
  /\ userActive = TRUE
  /\ refreshTimedOut = FALSE
  /\ logoutKilledAccess = FALSE
  /\ tick = 0

Bump == tick' = tick + 1

LoginOk ==
  /\ tick < 8
  /\ client = "anonymous"
  /\ userActive = TRUE
  /\ client' = "authenticated"
  /\ refresh' = "active"
  /\ accessLive' = TRUE
  /\ refreshTimedOut' = FALSE
  /\ logoutKilledAccess' = FALSE
  /\ UNCHANGED userActive
  /\ Bump

LoginBad ==
  /\ tick < 8
  /\ client = "anonymous"
  /\ client' = "anonymous"
  /\ UNCHANGED <<refresh, accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

MeOk ==
  /\ tick < 8
  /\ client = "authenticated"
  /\ accessLive = TRUE
  /\ userActive = TRUE
  /\ UNCHANGED <<client, refresh, accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

AccessFails ==
  /\ tick < 8
  /\ client = "authenticated"
  /\ client' = "refresh_needed"
  /\ accessLive' = FALSE
  /\ UNCHANGED <<refresh, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

RefreshOk ==
  /\ tick < 8
  /\ client = "refresh_needed"
  /\ refresh = "active"
  /\ refreshTimedOut = FALSE
  /\ userActive = TRUE
  /\ client' = "authenticated"
  /\ refresh' = "active"
  /\ accessLive' = TRUE
  /\ refreshTimedOut' = FALSE
  /\ UNCHANGED <<userActive, logoutKilledAccess>>
  /\ Bump

RefreshReplay ==
  /\ tick < 8
  /\ client = "refresh_needed"
  /\ refresh \in {"revoked", "none"}
  /\ client' = "anonymous"
  /\ refresh' = "revoked"
  /\ accessLive' = FALSE
  /\ UNCHANGED <<userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

RefreshExpiredOrDisabled ==
  /\ tick < 8
  /\ client = "refresh_needed"
  /\ \/ refreshTimedOut = TRUE
     \/ userActive = FALSE
  /\ client' = "anonymous"
  /\ refresh' = "revoked"
  /\ accessLive' = FALSE
  /\ UNCHANGED <<userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

LogoutOk ==
  /\ tick < 8
  /\ client = "authenticated"
  /\ refresh = "active"
  /\ client' = "anonymous"
  /\ refresh' = "revoked"
  /\ UNCHANGED <<accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

LogoutIdempotent ==
  /\ tick < 8
  /\ client = "anonymous"
  /\ refresh = "revoked"
  /\ client' = "anonymous"
  /\ refresh' = "revoked"
  /\ UNCHANGED <<accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

LogoutBad ==
  /\ tick < 8
  /\ client \in {"anonymous", "authenticated", "refresh_needed"}
  /\ client' = "anonymous"
  /\ accessLive' = FALSE
  /\ UNCHANGED <<refresh, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

SwitchInstitutionIgnored ==
  /\ tick < 8
  /\ client = "authenticated"
  /\ UNCHANGED <<client, refresh, accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

DisableUser ==
  /\ tick < 8
  /\ userActive = TRUE
  /\ userActive' = FALSE
  /\ \/ /\ client = "authenticated"
        /\ client' = "refresh_needed"
        /\ accessLive' = FALSE
     \/ /\ client # "authenticated"
        /\ UNCHANGED <<client, accessLive>>
  /\ UNCHANGED <<refresh, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

RefreshTimesOut ==
  /\ tick < 8
  /\ refresh = "active"
  /\ refreshTimedOut = FALSE
  /\ refreshTimedOut' = TRUE
  /\ \/ /\ client = "authenticated"
        /\ client' = "refresh_needed"
        /\ accessLive' = FALSE
     \/ /\ client # "authenticated"
        /\ UNCHANGED <<client, accessLive>>
  /\ UNCHANGED <<refresh, userActive, logoutKilledAccess>>
  /\ Bump

AccessExpires ==
  /\ tick < 8
  /\ accessLive = TRUE
  /\ accessLive' = FALSE
  /\ \/ /\ client = "authenticated"
        /\ client' = "refresh_needed"
     \/ /\ client # "authenticated"
        /\ UNCHANGED client
  /\ UNCHANGED <<refresh, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

\* Another device signs out while this client still needs to refresh.
RevokeWhileRefreshNeeded ==
  /\ tick < 8
  /\ client = "refresh_needed"
  /\ refresh = "active"
  /\ refresh' = "revoked"
  /\ UNCHANGED <<client, accessLive, userActive, refreshTimedOut, logoutKilledAccess>>
  /\ Bump

\* Wrong: logout also kills already-issued access immediately.
BugLogoutKillsAccess ==
  /\ tick < 8
  /\ client = "authenticated"
  /\ refresh = "active"
  /\ accessLive = TRUE
  /\ client' = "anonymous"
  /\ refresh' = "revoked"
  /\ accessLive' = FALSE
  /\ logoutKilledAccess' = TRUE
  /\ UNCHANGED <<userActive, refreshTimedOut>>
  /\ Bump

\* Wrong: revoked refresh still authenticates (store not consulted / race loser accepted).
BugRefreshReplayAccepted ==
  /\ tick < 8
  /\ client = "refresh_needed"
  /\ refresh = "revoked"
  /\ client' = "authenticated"
  /\ refresh' = "revoked"
  /\ accessLive' = TRUE
  /\ refreshTimedOut' = FALSE
  /\ UNCHANGED <<userActive, logoutKilledAccess>>
  /\ Bump

Done ==
  /\ tick = 8
  /\ UNCHANGED vars

Next ==
  \/ LoginOk
  \/ LoginBad
  \/ MeOk
  \/ AccessFails
  \/ RefreshOk
  \/ RefreshReplay
  \/ RefreshExpiredOrDisabled
  \/ LogoutOk
  \/ LogoutIdempotent
  \/ LogoutBad
  \/ SwitchInstitutionIgnored
  \/ DisableUser
  \/ RefreshTimesOut
  \/ AccessExpires
  \/ RevokeWhileRefreshNeeded
  \/ BugLogoutKillsAccess
  \/ BugRefreshReplayAccepted
  \/ Done

Spec == Init /\ [][Next]_vars

AuthenticatedIsConsistent ==
  (client = "authenticated") =>
    (refresh = "active" /\ accessLive = TRUE /\ refreshTimedOut = FALSE /\ userActive = TRUE)

RevokedNeverAuthenticated ==
  (refresh = "revoked") => client # "authenticated"

\* Locked C1 bound: logout revokes refresh; already-issued access lasts to expiry.
AccessSurvivesLogout ==
  logoutKilledAccess = FALSE

====
