import {
  infobipListExtractRecords,
  infobipListHasMore,
  parseInfobipPerson,
} from './infobip-people.parser';

describe('infobipListExtractRecords', () => {
  it('prefers persons when present', () => {
    expect(
      infobipListExtractRecords({
        persons: [{ id: '1' }],
        data: [{ id: '2' }],
      }),
    ).toEqual([{ id: '1' }]);
  });

  it('falls back through known keys', () => {
    expect(infobipListExtractRecords({ items: [{ a: 1 }] })).toEqual([
      { a: 1 },
    ]);
    expect(infobipListExtractRecords({})).toEqual([]);
  });
});

describe('infobipListHasMore', () => {
  it('returns false when no rows', () => {
    expect(infobipListHasMore({ page: 1, totalPages: 5 }, 0, 50)).toBe(
      false,
    );
  });

  it('uses page / totalPages when available', () => {
    expect(
      infobipListHasMore({ page: 1, totalPages: 5 }, 10, 50),
    ).toBe(true);
    expect(
      infobipListHasMore({ page: 5, totalPages: 5 }, 10, 50),
    ).toBe(false);
  });

  it('falls back to full page heuristic', () => {
    expect(infobipListHasMore({}, 50, 50)).toBe(true);
    expect(infobipListHasMore({}, 20, 50)).toBe(false);
  });
});

describe('parseInfobipPerson', () => {
  it('requires id and at least phone or email', () => {
    expect(parseInfobipPerson(null)).toBeNull();
    expect(parseInfobipPerson({})).toBeNull();
    expect(parseInfobipPerson({ id: 'abc' })).toBeNull();
  });

  it('parses contactInformation with EMAIL / SMS', () => {
    const p = parseInfobipPerson({
      personId: 'p1',
      firstName: 'Ann',
      lastName: 'B',
      contactInformation: [
        { channel: 'EMAIL', address: 'Test@Example.com' },
        { channel: 'SMS', value: '+38970111222' },
      ],
    });
    expect(p?.infobipPersonId).toBe('p1');
    expect(p?.emailNorm).toBe('test@example.com');
    expect(p?.phoneE164).toMatch(/^\+389/);
    expect(p?.name).toBe('Ann B');
  });

  it('parses nested detail.phoneNumber for Viber-style rows', () => {
    const p = parseInfobipPerson({
      guid: 'g-v',
      contactInformation: [
        {
          channel: 'Viber',
          detail: { phoneNumber: '+1 415 555 0100' },
        },
      ],
    });
    expect(p?.infobipPersonId).toBe('g-v');
    expect(p?.phoneE164).toMatch(/^\+1/);
  });
});
