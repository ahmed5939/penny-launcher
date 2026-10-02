import { describe, expect, it } from 'vitest'

import {
  extractBrNews,
  extractEmergencyNotices,
  extractGameNews,
  extractMessages,
  extractStwNews,
  isGameNewsEmpty,
} from './model'

/**
 * A small, representative slice of the real `fortnite-game` document: the STW
 * subpage with one visible and one hidden message, BR news under the v2 key,
 * and an active emergency notice under the v2 key. Trimmed to the fields the
 * model reads.
 */
const sample = {
  savetheworldnews: {
    news: {
      _title: 'savetheworldnews',
      messages: [
        {
          _type: 'CommonUI Simple Message Base',
          title: 'Blockbuster 2024',
          body: 'A new questline arrives in Save the World.',
          image: 'https://cdn2.unrealengine.com/stw-blockbuster.jpg',
          adspace: '1',
          hidden: false,
        },
        {
          title: 'Staged message',
          body: 'Not live yet.',
          image: 'https://cdn2.unrealengine.com/hidden.jpg',
          hidden: true,
        },
      ],
    },
  },
  battleroyalenewsv2: {
    news: {
      messages: [
        {
          title: 'Chapter 5 Season 3',
          body: 'Wrecked is here.',
          image: {
            url: 'https://shared-static-prod.epicgames.com/br-s3.png',
          },
          adspace: 2,
        },
      ],
    },
  },
  battleroyalenews: {
    news: {
      messages: [
        {
          title: 'Legacy BR message',
          body: 'Should be ignored when v2 has content.',
        },
      ],
    },
  },
  emergencynoticev2: {
    emergencynotices: {
      messages: [
        {
          title: 'Matchmaking disabled',
          body: 'We have temporarily disabled matchmaking.',
        },
      ],
    },
  },
}

describe('extractMessages', () => {
  it('normalises a message and resolves a string image', () => {
    const [message] = extractMessages(sample.savetheworldnews, 'news', 'stw')

    expect(message).toEqual({
      category: 'stw',
      title: 'Blockbuster 2024',
      body: 'A new questline arrives in Save the World.',
      image: 'https://cdn2.unrealengine.com/stw-blockbuster.jpg',
      adspace: '1',
    })
  })

  it('skips hidden messages', () => {
    const messages = extractMessages(sample.savetheworldnews, 'news', 'stw')

    expect(messages).toHaveLength(1)
    expect(messages.map((m) => m.title)).not.toContain('Staged message')
  })

  it('resolves an object-shaped image and stringifies a numeric adspace', () => {
    const [message] = extractMessages(sample.battleroyalenewsv2, 'news', 'br')

    expect(message.image).toBe('https://shared-static-prod.epicgames.com/br-s3.png')
    expect(message.adspace).toBe('2')
  })

  it('returns [] for a missing subpage', () => {
    expect(extractMessages(undefined, 'news', 'stw')).toEqual([])
    expect(extractMessages({}, 'news', 'stw')).toEqual([])
    expect(extractMessages({ news: {} }, 'news', 'stw')).toEqual([])
  })

  it('returns [] when messages is empty or the wrong type', () => {
    expect(extractMessages({ news: { messages: [] } }, 'news', 'stw')).toEqual([])
    expect(
      extractMessages({ news: { messages: 'nope' } }, 'news', 'stw'),
    ).toEqual([])
  })

  it('drops entries with neither title nor body', () => {
    const messages = extractMessages(
      { news: { messages: [{ image: 'x' }, {}] } },
      'news',
      'stw',
    )

    expect(messages).toEqual([])
  })

  it('leaves a missing image as null', () => {
    const [message] = extractMessages(
      { news: { messages: [{ title: 'No art', body: 'text' }] } },
      'news',
      'stw',
    )

    expect(message.image).toBeNull()
  })
})

describe('extractBrNews', () => {
  it('prefers the v2 subpage over the legacy one', () => {
    const messages = extractBrNews(sample)

    expect(messages).toHaveLength(1)
    expect(messages[0].title).toBe('Chapter 5 Season 3')
  })

  it('falls back to the legacy key when v2 is absent', () => {
    const messages = extractBrNews({
      battleroyalenews: sample.battleroyalenews,
    })

    expect(messages).toHaveLength(1)
    expect(messages[0].title).toBe('Legacy BR message')
  })

  it('falls back to the legacy key when v2 is present but empty', () => {
    const messages = extractBrNews({
      battleroyalenewsv2: { news: { messages: [] } },
      battleroyalenews: sample.battleroyalenews,
    })

    expect(messages[0].title).toBe('Legacy BR message')
  })
})

describe('extractEmergencyNotices', () => {
  it('reads the v2 emergency notices', () => {
    const notices = extractEmergencyNotices(sample)

    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      category: 'notice',
      title: 'Matchmaking disabled',
    })
  })

  it('falls back to the legacy emergency notice key', () => {
    const notices = extractEmergencyNotices({
      emergencynotice: {
        emergencynotices: {
          messages: [{ title: 'Legacy outage', body: 'Down.' }],
        },
      },
    })

    expect(notices[0].title).toBe('Legacy outage')
  })

  it('returns [] when there is no notice', () => {
    expect(extractEmergencyNotices({})).toEqual([])
    expect(extractEmergencyNotices(null)).toEqual([])
  })
})

describe('extractStwNews', () => {
  it('reads the save-the-world subpage', () => {
    const messages = extractStwNews(sample)

    expect(messages).toHaveLength(1)
    expect(messages[0].category).toBe('stw')
  })
})

describe('extractGameNews / isGameNewsEmpty', () => {
  it('groups all three surfaces', () => {
    const content = extractGameNews(sample)

    expect(content.stw).toHaveLength(1)
    expect(content.br).toHaveLength(1)
    expect(content.notices).toHaveLength(1)
    expect(isGameNewsEmpty(content)).toBe(false)
  })

  it('tolerates a completely empty / malformed document', () => {
    for (const input of [undefined, null, {}, [], 'nope', 42]) {
      const content = extractGameNews(input)

      expect(content).toEqual({ stw: [], br: [], notices: [] })
      expect(isGameNewsEmpty(content)).toBe(true)
    }
  })
})
