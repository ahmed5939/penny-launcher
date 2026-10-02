import type { OutpostMetadataProfile } from './outpost-types'

import { describe, expect, it } from 'vitest'

import {
  cloudSaveTimes,
  parseAmplifiers,
  parseOutpostMetadata,
} from './outpost-metadata'

/** Trimmed from a real `QueryProfile?profileId=metadata` response. */
const response: OutpostMetadataProfile = {
  profileChanges: [
    {
      profile: {
        created: '2018-06-19T20:30:14.100Z',
        updated: '2026-09-02T01:49:36.833Z',
        items: {
          '0798171f-4b01-460e-96e3-a613e0682780': {
            templateId: 'Outpost:outpostcore_pve_02',
            attributes: {
              cloud_save_info: {
                saveCount: 741,
                savedRecords: [
                  {
                    archiveNumber: 1,
                    recordFilename: '0798171f_r0_a1.sav',
                    recordIndex: 0,
                  },
                ],
              },
              level: 10,
              outpost_core_info: {
                accountsWithEditPermission: ['builder-a', 'builder-b'],
                highestEnduranceWaveReached: 22,
                placedBuildings: [
                  {
                    buildingTag: 'Outpost.BuildingActor.Building.01',
                    placedTag: 'Outpost.PlacementActor.Placement.00',
                  },
                  {
                    buildingTag: 'Outpost.BuildingActor.Building.00',
                    placedTag: 'Outpost.PlacementActor.Placement.01',
                  },
                  {
                    buildingTag: 'Outpost.BuildingActor.Building.02',
                    placedTag: 'Outpost.PlacementActor.Placement.04',
                  },
                ],
              },
            },
          },
          '8e531169-2fd7-4105-9019-711b8ecab6a9': {
            templateId: 'DeployableBaseCloudSave:testdeployablebaseitemdef',
            attributes: {
              cloud_save_info: {
                saveCount: 4,
                savedRecords: [{ recordFilename: 'deployable_r0_a0.sav' }],
              },
            },
          },
        },
      },
    },
  ],
}

describe('parseOutpostMetadata', () => {
  it('reads a zone and keeps every zone in page order', () => {
    const parsed = parseOutpostMetadata(response)

    expect(parsed?.zones.map((zone) => zone.zoneId)).toEqual([
      'pve_04',
      'pve_03',
      'pve_02',
      'pve_01',
    ])
    expect(parsed?.zones[2]).toEqual({
      amplifiers: [
        { building: 0, pad: 1 },
        { building: 1, pad: 0 },
        { building: 2, pad: 4 },
      ],
      editorIds: ['builder-a', 'builder-b'],
      highestEnduranceWave: 22,
      level: 10,
      saveCount: 741,
      saveFile: '0798171f_r0_a1.sav',
      zoneId: 'pve_02',
      zoneName: 'Plankerton',
    })
  })

  it('fills zones the profile has no Storm Shield for', () => {
    const twine = parseOutpostMetadata(response)?.zones[0]

    expect(twine).toMatchObject({ amplifiers: [], level: 0, saveFile: '', zoneName: 'Twine Peaks' })
  })

  it('ignores items that are not zone Storm Shields', () => {
    const files = parseOutpostMetadata(response)?.zones.map((zone) => zone.saveFile)

    expect(files).not.toContain('deployable_r0_a0.sav')
  })

  it('carries the profile dates', () => {
    expect(parseOutpostMetadata(response)?.summary).toEqual({
      createdAt: '2018-06-19T20:30:14.100Z',
      updatedAt: '2026-09-02T01:49:36.833Z',
    })
  })

  it('returns null without a profile', () => {
    expect(parseOutpostMetadata({ profileChanges: [] })).toBeNull()
    expect(parseOutpostMetadata(null)).toBeNull()
  })
})

describe('parseAmplifiers', () => {
  it('drops entries whose tags carry no index', () => {
    expect(
      parseAmplifiers([
        { buildingTag: 'Outpost.BuildingActor.Building', placedTag: 'Outpost.PlacementActor.Placement.02' },
        { buildingTag: 'Outpost.BuildingActor.Building.03' },
      ])
    ).toEqual([])
  })
})

describe('cloudSaveTimes', () => {
  it('maps file names to upload times', () => {
    const times = cloudSaveTimes([
      { filename: 'a_r0_a0.sav', uniqueFilename: 'a_r0_a0.sav', uploaded: '2026-09-02T01:49:36.295Z' },
      { filename: 'ClientSettings.Sav', uploaded: '2026-09-02T01:49:16.159Z' },
      { filename: 'no-time.sav' },
    ])

    expect(times.get('a_r0_a0.sav')).toBe('2026-09-02T01:49:36.295Z')
    expect(times.has('no-time.sav')).toBe(false)
  })

  it('tolerates a missing listing', () => {
    expect(cloudSaveTimes(undefined).size).toBe(0)
  })
})
