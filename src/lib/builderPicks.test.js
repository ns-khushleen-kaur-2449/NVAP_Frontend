import { dropPicks, loadPicks, mergePicks, savePicks } from './builderPicks';

beforeEach(() => window.sessionStorage.clear());

it('keeps picks for the same user across reloads until they are emptied', () => {
  savePicks(1, [{ id: 'a', name: 'Asha' }]);
  expect(loadPicks(1)).toEqual([{ id: 'a', name: 'Asha' }]);
  savePicks(1, []);
  expect(loadPicks(1)).toEqual([]);
});

it('never hands one user another user\'s picks', () => {
  savePicks(1, [{ id: 'a' }]);
  expect(loadPicks(2)).toEqual([]);
  expect(loadPicks(null)).toEqual([]);
});

it('adds new picks to the old ones without duplicates', () => {
  expect(mergePicks([{ id: 'a', name: 'Old' }, { id: 'b' }], [{ id: 'a', name: 'New' }, { id: 'c' }]))
    .toEqual([{ id: 'a', name: 'New' }, { id: 'b' }, { id: 'c' }]);
  expect(dropPicks([{ id: 'a' }, { id: 'b' }], ['a'])).toEqual([{ id: 'b' }]);
});

it('survives storage that cannot be read', () => {
  window.sessionStorage.setItem('smartsdr.builder.fromProspecting', '{broken');
  expect(loadPicks(1)).toEqual([]);
});
