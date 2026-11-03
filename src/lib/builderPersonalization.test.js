import {
  allProblems, defaultSelection, placeholdersFor, problemsFrom, registryGroups, splitProtected,
} from './builderPersonalization';

const email = { key: 'email', label: 'Email on file', usages: ['confirm_only', 'never_say'], masks: ['none'], default_mask: 'none' };
const phone = { key: 'phone', label: 'Phone', usages: ['confirm_only', 'never_say'], masks: ['none', 'last4'], default_mask: 'last4' };
const city = { key: 'city', label: 'Their city', usages: ['greet', 'context', 'confirm_only', 'never_say'], masks: ['none'], default_mask: 'none' };

it('ticks contact details as confirm-only (the email in full, the phone masked), and others with a usage they allow', () => {
  expect(defaultSelection(email)).toEqual({ key: 'email', usage: 'confirm_only', mask: 'none', label: '' });
  expect(defaultSelection(phone)).toEqual({ key: 'phone', usage: 'confirm_only', mask: 'last4', label: '' });
  expect(defaultSelection(city)).toMatchObject({ usage: 'context', mask: 'none' });
  expect(defaultSelection({ ...city, key: 'first_name' }).usage).toBe('greet');
  expect(defaultSelection({ ...city, key: 'source', usages: ['context', 'never_say'] }).usage).toBe('context');
});

it('offers name placeholders only when first name is selected to greet', () => {
  const tokens = (fields) => placeholdersFor(fields).map((p) => p.token);
  expect(tokens([])).toEqual(['{agent_name}', '{company}', '{call_reason}']);
  expect(tokens([{ key: 'first_name', usage: 'context' }])).not.toContain('{customer_name}');
  expect(tokens([{ key: 'first_name', usage: 'greet' }])).toEqual(
    ['{salutation}', '{customer_name}', '{agent_name}', '{company}', '{call_reason}']);
});

it('splits a 422 into fields, for plain-string and Pydantic errors', () => {
  const strings = problemsFrom({ response: { data: { detail: ['first_message: unknown placeholder {name}', "Unknown tool 'x'"] } } });
  expect(strings.first_message).toEqual(['first_message: unknown placeholder {name}']);
  expect(strings.general).toEqual(["Unknown tool 'x'"]);
  const pydantic = problemsFrom({ response: { data: { detail: [
    { loc: ['body', 'assistant', 'default_call_reason'], msg: 'Value error, must not contain a price' },
    { loc: ['body', 'lead_fields', 0], msg: "Value error, 'email' cannot be used as 'greet'" },
  ] } } });
  expect(pydantic.default_call_reason).toEqual(['must not contain a price']);
  expect(pydantic.lead_fields).toEqual(["'email' cannot be used as 'greet'"]);
  expect(problemsFrom(null).general).toEqual([]);
});

it('finds protected blocks between smartsdr markers', () => {
  const prompt = 'Intro\n\n<!-- smartsdr:tools:start -->\n## Tools you can use\n- rule\n<!-- smartsdr:tools:end -->\n\n## Your goal';
  expect(splitProtected(prompt)).toEqual([
    { type: 'text', text: 'Intro' },
    { type: 'protected', name: 'tools', title: 'Tools you can use', text: '## Tools you can use\n- rule' },
    { type: 'text', text: '## Your goal' },
  ]);
  expect(splitProtected('No markers')).toEqual([{ type: 'text', text: 'No markers' }]);
});

it('keeps a selected custom field visible even when no lead has it any more', () => {
  const [, custom] = registryGroups({ standard: [], custom: [] }, [{ key: 'custom.unit_type', usage: 'context' }]);
  expect(custom.fields.map((f) => f.key)).toEqual(['custom.unit_type']);
});


it('routes language, gender and catalog-word refusals to their own fields', () => {
  const problems = problemsFrom({ response: { data: { detail: [
    "assistant.language: 'multi' is not a language this builder speaks; pick one of English (en).",
    "assistant.persona_gender: Testish needs the agent's gender",
    'catalog words: the agent says or reads label, which have no Testish text; add them',
    'first_message: unknown placeholder {x}',
    'something else',
  ] } } });
  expect(problems.language).toEqual(["'multi' is not a language this builder speaks; pick one of English (en)."]);
  expect(problems.persona_gender).toEqual(["Testish needs the agent's gender"]);
  expect(problems.catalog_words).toEqual(['catalog words: the agent says or reads label, which have no Testish text; add them']);
  expect(problems.first_message).toEqual(['first_message: unknown placeholder {x}']);
  expect(problems.general).toEqual(['something else']);
  expect(allProblems(problems)).toHaveLength(5);
});

