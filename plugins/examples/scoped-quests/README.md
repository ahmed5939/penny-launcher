# Selected account quests

Import this folder from Penny's Add-ons page and review its three permissions.
Select a primary account, then press **Read selected account quests** on its card.
Penny authenticates the read internally; the plugin never receives credentials.
Reads are limited to one per 10 seconds and the account must remain in scope.
The job can be cancelled. An already dispatched service read may finish, but its
result is discarded if the plugin stops or the account leaves the scope.

This example writes no persistent data and makes no game changes.
