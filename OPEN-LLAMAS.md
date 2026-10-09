# Open llamas

Save the World → Open llamas (beta) opens card packs the selected account already owns. It does not buy llamas, spend vouchers or tickets, claim quests or claim mission rewards. The Shop's "Open N llamas" button now leads here; the old one-click "open everything" action is gone.

## Using it

1. Pick the account in the title bar. The page lists every `CardPack:` type on the account with its quantity. Every type starts included. Choice packs ("pick a hero") cannot be opened here and are marked "Needs a choice".
2. Untick types to exclude them, or use Select all types / Clear selection. Search and paging only change what is shown; a hidden type keeps its state.
3. Auto Recycle defaults to No Auto Recycle. Below Uncommon … Below Mythic recycle new rewards strictly below the named rarity. Mythic is never recycled.
4. Number to open: blank opens every selected pack. Otherwise enter a whole number from 1 to the selected count. If you untick types after typing a number that no longer fits, the number stays and Open is disabled until you fix it.
5. Open asks twice. While a run is going, its settings are locked and Stop finishes the request in flight, then stops.

Choices are kept per account for the session only. They never change Auto Llamas or any other automation.

## What a run does

- **Ordering.** A limited number is filled in template-ID order, then pack-GUID order (code-unit comparison, so it is the same in every locale). The type list shows "Opens N of M" for each type. A stacked GUID is taken whole or skipped, never split. If no combination in that order reaches your number exactly, Open stays disabled and says how far it gets.
- **Whitelist.** The main process keeps the preview it showed you. Open sends only the preview ID, the selected template IDs, the number and the recycle choice. The run freezes the eligible GUIDs, then re-reads the inventory. If any of them changed, it stops before opening anything. Before every request it checks each GUID again against the frozen list and its live type. Excluded types, packs acquired after the preview and packs dropped by other packs are never added.
- **Batches.** `OpenCardPackBatch` takes up to 25 GUIDs, and at most 25 packs per request unless a single stack is bigger. `RecycleItemBatch` takes up to 100 GUIDs. These are the bot's choices, not Epic limits.
- **Counting.** Packs opened = inventory quantity consumed, never GUIDs sent. Items recycled = reward GUIDs confirmed gone after the recycle request. Items not recycled = item rewards from the opening replies minus those recycled. Resources (XP, evolution materials, currencies) are left out of both item counts. "Packs left on account" counts every type, excluded ones included.
- **Locking.** One run per account at a time. A run waits for Auto Llamas or Auto Expeditions on the same account to finish, and those wait for it.

## What is recycled

Only rewards whose GUIDs the opening reply named, that did not exist before the request or the run, and that are still in the inventory with the same template and quantity. Supported kinds are heroes, schematics, survivors and defenders. Always kept:

- favourites
- anything in a squad, building slot or hero loadout
- quest items
- weapons, traps and other unsupported kinds
- resources
- any reward whose rarity is unknown or ambiguous

The rarity in the template ID must match the item database. Because mythic heroes also carry `sr` in their IDs, Legendary is only recycled when the database confirms it.

Opening runs separately from the Auto Llamas/Expeditions recycling helper, which still stops at Epic.

## When something goes wrong

A state-changing request is never retried. If Epic refuses a request, the run stops and says why. If a request's outcome is unknown (timeout, network error, 5xx), the run reads the inventory once to confirm what happened. If even that fails, the panel shows the request under "Not confirmed", kept out of both totals. Confirmed totals from earlier batches are kept. If Epic opens packs but does not list their rewards, the run stops rather than guess. Refresh before starting again.

The runtime log records only an HTTP status or error name for failures. Requests, headers, tokens and response bodies are not logged.

## Not yet verified live

Tests use synthetic profiles and a fake Epic client (`src/features/open-llamas/*.test.ts*`, `src/kernel/core/open-llamas*.test.ts`, `src/state/stw-operations/open-llamas.test.ts`). These still need a controlled check on a real account:

- the `OpenCardPackBatch` reply shape (loot read from `notifications[].lootGranted.items`, with `itemAdded` profile changes as a fallback)
- how Epic consumes a stacked GUID (the run handles both "whole stack" and "one per request")
- how choice packs are flagged (template ID contains `choice`, or the item has `options`)
- recycling of real rewards
