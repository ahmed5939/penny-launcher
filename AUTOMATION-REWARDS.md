# Auto Llama recycling and combined rewards

Auto Llamas now has an account-specific rarity ceiling: Off, Common, Uncommon, Rare, or Epic. Rare means Common through Rare. Off is the default. These controls apply to free and survivor llama purchases without changing the user's purchase preferences.

Automate → Recycled Rewards combines all local account receipts from Auto Llamas and existing Auto Expedition history. Filters cover accounts, automation, and rolling day/week/month/year/all-time periods. It shows received item quantities, recycled item quantities, positive resources gained from recycling, account totals, event details, errors, and a filtered JSON export. Received and recycling-gain totals remain separate to avoid double counting.

Llama rewards are read from the purchase notification's loot.items, loot.lootGranted.items, lootGranted.items, or lootResult.items. No inventory-wide delta is used to choose items to destroy. Recycling requires a confirmed reward GUID, absent before purchase, that matches the new inventory item and quantity. Unknown or missing GUIDs are kept. Hero, Worker, Defender, and Schematic rewards can be recycled. Favorites, assigned/loadout items, Legendary/Mythic/unknown rarity and preexisting items are protected. World weapons/traps are kept.

The new automation-rewards.json file sits alongside auto-expeditions.json. It stores only settings and reward receipts, not credentials. Updates are serialized and atomically renamed. Receipts are saved before recycling; interrupted or failed recycling is not automatically retried. Llama and expedition work share a per-account queue. Other clients and in-game inventory changes are outside that queue, so resource-delta attribution assumes no simultaneous external inventory mutations.

The combined view reads expedition history directly; it does not duplicate or migrate that file. Old expedition records without quantities remain annotated. Previous llama pop-up notifications cannot be reconstructed retrospectively. Reporting covers local Auto Llamas and Auto Expeditions, not Discord history, manual purchases, or other automations.

Validation includes focused tests for loot shapes, rarity validation, receipt retention on recycling errors, verified recycling/resource deltas, existing-inventory protection, concurrent account records, existing expedition reporting, and the existing expedition regression suite. Installed-build adapters preserve unrelated additions. Live purchases/recycling are not invoked during testing.
