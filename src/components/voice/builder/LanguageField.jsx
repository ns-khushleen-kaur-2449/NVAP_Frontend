import React from 'react';
import { OptionSelect } from './BuilderFields';

// The languages the backend speaks today (app/features/assistant_builder/i18n). One default
// language for now; a multi-select of allowed languages replaces this component later and keeps
// the same props (value = the default language, onChange).
export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];

export default function LanguageField({ value, onChange }) {
  return <OptionSelect value={value} onChange={onChange} options={LANGUAGES} ariaLabel="Language" />;
}
