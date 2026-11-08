export const title = "Genki session and refresh tokens";

export const state = (v) => {
  const client =
    v.client === "anonymous"
      ? "Signed out"
      : v.client === "authenticated"
        ? "Signed in"
        : "Needs refresh";
  const store =
    v.refresh === "none"
      ? "No refresh on file"
      : v.refresh === "active"
        ? v.refreshTimedOut
          ? "Refresh expired on file"
          : "Refresh on file"
        : "Refresh revoked on file";
  const access = v.accessLive ? "Access still valid" : "Access gone";
  const user = v.userActive ? "User active" : "User disabled";
  return [client, store, access, user];
};

export const step = (action, from, to) => {
  switch (action) {
    case "LoginOk":
      return "you sign in with a valid account";
    case "LoginBad":
      return "you sign in with a bad password or institution";
    case "MeOk":
      return "you open your profile";
    case "AccessFails":
      return "your access token is rejected";
    case "RefreshOk":
      return "you refresh with the current token";
    case "RefreshReplay":
      return "you reuse an old refresh token";
    case "RefreshExpiredOrDisabled":
      return "you refresh after expiry or a disabled user";
    case "LogoutOk":
      return "you sign out";
    case "LogoutIdempotent":
      return "you sign out again with the same refresh";
    case "LogoutBad":
      return "you sign out with a bad refresh token";
    case "SwitchInstitutionIgnored":
      return "you change institution without signing in again";
    case "DisableUser":
      return "an admin disables the user";
    case "RefreshTimesOut":
      return "the refresh token expires";
    case "AccessExpires":
      return "the access token expires";
    case "RevokeWhileRefreshNeeded":
      return "another device signs you out";
    case "BugLogoutKillsAccess":
      return "BUG: sign-out also kills the access token";
    case "BugRefreshReplayAccepted":
      return "BUG: an old refresh token is accepted again";
    case "Done":
      return null;
    default:
      return action;
  }
};

export const group = (v) => {
  if (v.client === "authenticated") return "signed-in";
  if (v.client === "refresh_needed") return "needs-refresh";
  if (v.refresh === "revoked") return "revoked";
  return "signed-out";
};

export const colors = {
  "signed-in": "teal",
  "needs-refresh": "orange",
  revoked: "pink",
  "signed-out": "blue",
};
