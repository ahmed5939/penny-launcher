/**
 * The eight survivor squads, and the slots each one has.
 *
 * Ids and slot semantics are from the Fortnite endpoint documentation
 * (`AssignWorkerToSquadBatch`): slot 0 is always the squad leader, slots 1–7
 * are the support survivors.
 *
 * @see https://github.com/LeleDerGrasshalmi/FortniteEndpointsDocumentation
 */

export const squadSlotCount = 8

export const squadLeaderSlotIndex = 0

export type SquadDefinition = {
  id: string
  label: string
  /** Which of the four homebase attributes this squad feeds. */
  attribute: 'arms' | 'medicine' | 'scavenging' | 'synthesis'
}

export const survivorSquads: Array<SquadDefinition> = [
  {
    id: 'Squad_Attribute_Medicine_EMTSquad',
    label: 'EMT Squad',
    attribute: 'medicine',
  },
  {
    id: 'Squad_Attribute_Arms_FireTeamAlpha',
    label: 'Fire Team Alpha',
    attribute: 'arms',
  },
  {
    id: 'Squad_Attribute_Scavenging_Gadgeteers',
    label: 'Gadgeteers',
    attribute: 'scavenging',
  },
  {
    id: 'Squad_Attribute_Synthesis_CorpsofEngineering',
    label: 'Corps of Engineering',
    attribute: 'synthesis',
  },
  {
    id: 'Squad_Attribute_Medicine_TrainingTeam',
    label: 'Training Team',
    attribute: 'medicine',
  },
  {
    id: 'Squad_Attribute_Arms_CloseAssaultSquad',
    label: 'Close Assault Squad',
    attribute: 'arms',
  },
  {
    id: 'Squad_Attribute_Scavenging_ScoutingParty',
    label: 'Scouting Party',
    attribute: 'scavenging',
  },
  {
    id: 'Squad_Attribute_Synthesis_TheThinkTank',
    label: 'The Think Tank',
    attribute: 'synthesis',
  },
]

export const squadLabelsById = survivorSquads.reduce(
  (accumulator, squad) => {
    accumulator[squad.id] = squad.label

    return accumulator
  },
  {} as Record<string, string>
)
