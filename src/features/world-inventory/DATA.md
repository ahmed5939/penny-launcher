# World inventory display data

weapon-display.json contains names, rarity, tier, descriptions and image filenames for 3,795 crafted weapons from PegLegFN/PegLegResources, major branch, GameAssets/NamedItems/Weapon.json, retrieved 20 September 2026. Bulky weapon-stat tables are omitted. Artwork uses the Launcher's existing PegLeg image URLs.

weapon-perks.json contains 472 modern and surviving legacy descriptions from the local 42.10 perk audit under ../reports/perk-audit-42.10 (relative to the Launcher checkout). Rarity comes from the extracted definition or an unambiguous rarity in slotDefinitions. Legacy descriptions and rarities come from legacy/legacy_perk_dictionary.json. Missing rarity is displayed as unavailable; it is not inferred from the weapon rarity. These are current extracted descriptions, not assertions of historical obtainability or legality.

The actual perk IDs, order, empty slots, and repeated rolls come from each live weapon's attributes.alterations. Default loadouts and schematic perk rolls are never substituted. Item names/art prefer an exact live database record, with the bundled crafted-weapon catalog as fallback.
