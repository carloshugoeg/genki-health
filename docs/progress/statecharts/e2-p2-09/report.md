# Session

TLC reached 158 states and 599 steps. The chart draws 19 states and 46 arrows.
The chart does not draw 208 steps that stay in one chart state.
The view hides 25 steps, so the chart does not draw them.

## AccessSurvivesLogout breaks
The shortest path has 2 steps:
0. Signed out / No refresh on file / Access gone / User active
1. you sign in with a valid account: Signed in / Refresh on file / Access still valid / User active
2. BUG: sign-out also kills the access token: Signed out / Refresh revoked on file / Access gone / User active

## AuthenticatedIsConsistent breaks
The shortest path has 4 steps:
0. Signed out / No refresh on file / Access gone / User active
1. you sign in with a valid account: Signed in / Refresh on file / Access still valid / User active
2. the access token expires: Needs refresh / Refresh on file / Access gone / User active
3. another device signs you out: Needs refresh / Refresh revoked on file / Access gone / User active
4. BUG: an old refresh token is accepted again: Signed in / Refresh revoked on file / Access still valid / User active

## RevokedNeverAuthenticated breaks
The shortest path has 4 steps:
0. Signed out / No refresh on file / Access gone / User active
1. you sign in with a valid account: Signed in / Refresh on file / Access still valid / User active
2. the access token expires: Needs refresh / Refresh on file / Access gone / User active
3. another device signs you out: Needs refresh / Refresh revoked on file / Access gone / User active
4. BUG: an old refresh token is accepted again: Signed in / Refresh revoked on file / Access still valid / User active

## Rules that hold
TypeOK
