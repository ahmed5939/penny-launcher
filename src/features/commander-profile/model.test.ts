import { describe, expect, it } from 'vitest'

import { parseCommanderProfile, setBonusName } from './model'

const accountId = 'acc'

function body(items: Record<string, unknown>, attributes: Record<string, unknown> = {}) {
  return { profileChanges: [{ profile: { accountId, attributes: {}, items, profileId: 'campaign', stats: { attributes } } }] }
}

const worker = (squad: string, slot: number, extra: Record<string, unknown> = {}) => ({
  attributes: { level: 50, personality: 'Homebase.Worker.Personality.IsAnalytical', squad_id: squad, squad_slot_idx: slot, ...extra },
  templateId: 'Worker:workerbasic_sr_t05',
})

describe('parseCommanderProfile', () => {
  it('reads F.O.R.T. from the stored Stat items and ignores the Ventures ones', () => {
    const entry = parseCommanderProfile(
      body({
        a: { quantity: 5662, templateId: 'Stat:fortitude' },
        b: { quantity: 5678, templateId: 'Stat:offense' },
        c: { quantity: 5662, templateId: 'Stat:resistance' },
        d: { quantity: 5678, templateId: 'Stat:technology' },
        e: { quantity: 503, templateId: 'Stat:fortitude_phoenix' },
      }),
      accountId,
      'Name'
    )

    expect(entry.fort).toEqual({ fortitude: 5662, offense: 5678, resistance: 5662, technology: 5678 })
    expect(entry.power?.value).toBeGreaterThan(0)
  })

  it('reports no F.O.R.T. rather than zeros when the profile has none', () => {
    const entry = parseCommanderProfile(body({}), accountId, 'Name')

    expect(entry.fort).toBeNull()
    expect(entry.power).toBeNull()
  })

  it('counts set bonuses per squad, and lead job and personality matches', () => {
    const squad = 'squad_attribute_medicine_emtsquad'
    const trap = { set_bonus: 'Homebase.Worker.SetBonus.IsTrapDurabilityHigh' }
    const entry = parseCommanderProfile(
      body({
        lead: { attributes: { managerSynergy: 'Homebase.Manager.IsDoctor', personality: 'Homebase.Worker.Personality.IsAnalytical', squad_id: squad, squad_slot_idx: 0 }, templateId: 'Worker:managerdoctor_sr_t05' },
        s1: worker(squad, 1, trap),
        s2: worker(squad, 2, trap),
        s3: worker(squad, 3, { ...trap, personality: 'Homebase.Worker.Personality.IsDreamer' }),
        s4: worker(squad, 4, { set_bonus: 'Homebase.Worker.SetBonus.IsMeleeDamageLow' }),
      }),
      accountId,
      'Name'
    )
    const emt = entry.squads.find((candidate) => candidate.label === 'EMT Squad')

    expect(emt).toMatchObject({ filled: 5, leadMatches: true, personalityMatches: 3 })
    expect(entry.setBonuses).toEqual([
      { active: 1, matched: 3, name: 'Trap Durability', totalPct: 8 },
      { active: 0, matched: 1, name: 'Melee Damage', totalPct: 0 },
    ])
  })

  it('finds the equipped loadout commander and support team', () => {
    const entry = parseCommanderProfile(
      body(
        {
          h1: { attributes: { level: 60 }, templateId: 'Hero:hid_commando_sr_t05' },
          h2: { attributes: { level: 50 }, templateId: 'Hero:hid_ninja_sr_t04' },
          other: { attributes: { crew_members: { commanderslot: 'h2' } }, templateId: 'CampaignHeroLoadout:loadout' },
          picked: { attributes: { crew_members: { commanderslot: 'h1', followerslot2: 'h2' } }, templateId: 'CampaignHeroLoadout:loadout' },
        },
        { selected_hero_loadout: 'picked' }
      ),
      accountId,
      'Name'
    )

    expect(entry.commander).toEqual({ level: 60, templateId: 'Hero:hid_commando_sr_t05', tier: 5 })
    expect(entry.support).toEqual([{ level: 50, templateId: 'Hero:hid_ninja_sr_t04', tier: 4 }])
  })

  it('refuses another account or another profile', () => {
    expect(() => parseCommanderProfile({ profileChanges: [{ profile: { accountId: 'x', profileId: 'campaign' } }] }, accountId, 'N')).toThrow()
    expect(() => parseCommanderProfile({ profileChanges: [{ profile: { accountId, profileId: 'athena' } }] }, accountId, 'N')).toThrow()
  })
})

describe('helpers', () => {
  it('names set bonuses the way the game shows them', () => {
    expect(setBonusName('Homebase.Worker.SetBonus.IsResistanceLow')).toBe('Shield')
    expect(setBonusName('Homebase.Worker.SetBonus.IsShieldRegenLow')).toBe('Shield Regeneration')
    expect(setBonusName('Homebase.Worker.SetBonus.IsFortitudeLow')).toBe('Health')
  })

  it('rates Power from squads and research, flagging part-way research', () => {
    const squad = 'squad_attribute_medicine_emtsquad'
    const items = { s1: worker(squad, 1), s2: worker(squad, 2) }
    const low = parseCommanderProfile(body(items, { research_levels: { fortitude: 0, offense: 0, resistance: 0, technology: 0 } }), accountId, 'N')
    const mid = parseCommanderProfile(body(items, { research_levels: { fortitude: 60, offense: 60, resistance: 60, technology: 60 } }), accountId, 'N')
    const max = parseCommanderProfile(body(items, { research_levels: { fortitude: 120, offense: 120, resistance: 120, technology: 120 } }), accountId, 'N')

    expect(mid.power!.value).toBeGreaterThan(low.power!.value)
    expect(max.power!.value).toBeGreaterThan(mid.power!.value)
    expect([low.power!.approximate, mid.power!.approximate, max.power!.approximate]).toEqual([false, true, false])
  })
})
