import {
  MAX_CAMPAIGN_CONTACTS, addProspects, hasCallablePhone, removeIds, selectedIds, toggleProspect, unselectableReason,
} from './prospectSelection';

const prospect = (id, phone = '+919800000001', extra = {}) => ({ prospect_id: id, full_name: `Lead ${id}`, phone, ...extra });

describe('hasCallablePhone', () => {
  it.each([
    ['+919800000001', true],
    ['98000 00001', true],
    ['', false],
    [null, false],
    ['12345', false],
    ['1234567890123456', false],
  ])('%p -> %p', (phone, expected) => {
    expect(hasCallablePhone({ phone })).toBe(expected);
  });

  it('explains why a prospect without a phone cannot be picked', () => {
    expect(unselectableReason(prospect('a', null))).toBe('No phone number to call');
    expect(unselectableReason(prospect('a'))).toBeNull();
  });
});

describe('selection across result pages', () => {
  it('keeps earlier picks while later pages are added, in pick order', () => {
    const page1 = [prospect('a'), prospect('b'), prospect('c', '')];
    const page2 = [prospect('d'), prospect('a')];
    let { selection, added, skipped } = addProspects(new Map(), page1);
    expect([added, skipped]).toEqual([2, 1]);
    ({ selection } = toggleProspect(selection, prospect('d')));
    ({ selection, added } = addProspects(selection, page2));
    expect(added).toBe(0); // a is already there, d was toggled on
    expect(selectedIds(selection)).toEqual(['a', 'b', 'd']);
    expect(selection.get('a')).toEqual({ id: 'a', name: 'Lead a', phone: '+919800000001' });
  });

  it('toggles a prospect off and removes a page', () => {
    let { selection } = addProspects(new Map(), [prospect('a'), prospect('b'), prospect('c')]);
    ({ selection } = toggleProspect(selection, prospect('b')));
    expect(selectedIds(selection)).toEqual(['a', 'c']);
    expect(selectedIds(removeIds(selection, ['a', 'c', 'missing']))).toEqual([]);
  });

  it('never selects a prospect without a phone, even when toggled directly', () => {
    const { selection } = toggleProspect(new Map(), prospect('x', ''));
    expect(selection.size).toBe(0);
  });

  it(`stops at the campaign limit of ${MAX_CAMPAIGN_CONTACTS}`, () => {
    const many = Array.from({ length: MAX_CAMPAIGN_CONTACTS + 3 }, (_, i) => prospect(`p${i}`));
    const { selection, added, capped } = addProspects(new Map(), many);
    expect([selection.size, added, capped]).toEqual([MAX_CAMPAIGN_CONTACTS, MAX_CAMPAIGN_CONTACTS, 3]);
    expect(toggleProspect(selection, prospect('one-more')).capped).toBe(true);
  });
});
