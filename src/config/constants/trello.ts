/**
 * "The Bug List | Save The World" — the community-run Trello board that
 * tracks STW bugs, Epic posts and seasonal reference material.
 *
 * Its "Yearly Content Timeline" list keeps one card per Ventures season,
 * whose description states what the PegLeg feed never carries: the season
 * kind (Miniboss/Mutant), which elemental mission alerts run, the modifier,
 * the seasonal llama's plain name, the event mode, and what else is on
 * during the season. Public boards answer unauthenticated reads of a single
 * list's cards, so this stays a ~13KB request instead of the 15MB
 * whole-board export.
 *
 * @see https://trello.com/b/D8pTrVFC/the-bug-list-stw
 */

export const bugListTimelineListId = '693dc9ef25df09c7086f4e45'

export const bugListTimelineCardsURL =
  `https://api.trello.com/1/lists/${bugListTimelineListId}/cards` +
  '?fields=name,desc&attachments=true&attachment_fields=name,url'
