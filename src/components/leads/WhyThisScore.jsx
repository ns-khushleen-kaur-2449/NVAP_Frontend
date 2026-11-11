import DataCompleteness from './DataCompleteness';
import {
  INDICATORS,
  TREATMENT_TEXT,
  featureLabel,
  groupLabel,
  valueLabel,
} from '@/lib/leadScoreLabels';

// Numbers are shown exactly as the API sends them; nothing is recalculated here.
const num = (value) => (value == null ? '—' : String(value));

const freshnessText = (freshness) => {
  if (!freshness || freshness.status === 'disabled') return null;
  if (freshness.age_days == null) return `age unknown · counted ×${num(freshness.multiplier)}`;
  return `call ${num(freshness.age_days)} days ago · counted ×${num(freshness.multiplier)}`;
};

const bandRange = (bands, label) => {
  const band = (bands || []).find((item) => item.label === label);
  return band ? `${band.label} is ${band.min}–${band.max}` : null;
};

const NOT_SCORED = { has_email: 'email on file', verified_email: 'email verified', has_phone: 'phone on file' };

function FactorRow({ factor }) {
  const indicator = INDICATORS[factor.indicator];
  const value = valueLabel(factor.feature, factor.value);
  const unavailable = factor.indicator === 'unavailable';
  const share = factor.possible ? Math.max(0, Math.min(100, ((factor.earned || 0) / factor.possible) * 100)) : 0;
  const fresh = freshnessText(factor.freshness);
  return (
    <li className="text-xs" data-testid={`factor-${factor.feature}`}>
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          {indicator && <span aria-label={indicator.label} title={indicator.label} className="mr-1">{indicator.icon}</span>}
          <span className="font-medium">{featureLabel(factor.feature)}</span>
          <span className="block text-muted-foreground break-words">
            {unavailable ? 'Information unavailable' : value}
            {factor.indicator === 'inconclusive' && ' · inconclusive assessment, not evidence of buying interest'}
            {fresh && ` · ${fresh}`}
          </span>
          {unavailable && factor.treatment && TREATMENT_TEXT[factor.treatment] && (
            <span className="block text-muted-foreground">{TREATMENT_TEXT[factor.treatment]}</span>
          )}
          {unavailable && factor.note && <span className="block text-muted-foreground">{factor.note}</span>}
        </span>
        <span className="shrink-0 tabular-nums">
          {factor.earned == null ? '—' : `+${num(factor.earned)}`}
          {factor.possible != null && <span className="text-muted-foreground"> of {num(factor.possible)}</span>}
        </span>
      </div>
      {factor.possible != null && (
        <div className="mt-1 h-1 w-full rounded bg-muted" aria-hidden="true">
          <div className="h-1 rounded bg-primary" style={{ width: `${share}%` }} />
        </div>
      )}
    </li>
  );
}

function SettingsUsed({ configuration, methodologyVersion }) {
  if (!configuration) return null;
  const hash = configuration.hash || configuration.config_hash;
  return (
    <details className="mt-3 text-xs" data-testid="settings-used">
      <summary className="cursor-pointer text-muted-foreground">Settings used</summary>
      <div className="mt-1 space-y-1 text-muted-foreground">
        {methodologyVersion && <p>Method: {methodologyVersion}</p>}
        {hash && <p>Settings ID: <span className="font-mono">{hash.slice(0, 8)}</span></p>}
        {configuration.recorded_in_full ? (
          <p>
            Recorded in full (format {configuration.configuration_schema_version})
            {configuration.hash_verified ? ' · verified' : ' · could not be verified'}
          </p>
        ) : (
          <p>The full settings were not recorded for scores calculated before this was added.</p>
        )}
        {configuration.group_weights && (
          <p>
            Points: {Object.entries(configuration.group_weights).map(([group, weight]) => `${groupLabel(group)} ${num(weight)}`).join(' · ')}
          </p>
        )}
        {configuration.effective_weights && (
          <p>
            Weights: {Object.entries(configuration.effective_weights).map(([feature, weight]) => `${featureLabel(feature)} ${num(weight)}`).join(' · ')}
          </p>
        )}
        {configuration.freshness_bands && Object.entries(configuration.freshness_bands).map(([feature, bands]) => (
          <p key={feature}>
            {featureLabel(feature)} by age: {bands.map((band) => (band.max_days == null ? `older ×${num(band.multiplier)}` : `≤${band.max_days} days ×${num(band.multiplier)}`)).join(' · ')}
          </p>
        ))}
        {configuration.temperature_bands && (
          <p>Thresholds: {configuration.temperature_bands.map((band) => `${band.label} ${band.min}–${band.max}`).join(' · ')}</p>
        )}
      </div>
    </details>
  );
}

/**
 * "Why this score?": the explanation of one recorded calculation, exactly as the API
 * sends it (`explanation` of a current score, `explanation_view` of a history item).
 * Built only from what that calculation recorded: settings changed later never change it.
 */
export default function WhyThisScore({ explanation, historical = false }) {
  if (!explanation?.available) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="explanation-unavailable">
        Score explanation unavailable. This score has no recorded calculation (demo data). Recalculate to create one.
      </p>
    );
  }
  const configuration = explanation.configuration || {};
  const threshold = bandRange(configuration.temperature_bands, explanation.temperature_at_calculation);
  const quality = explanation.not_scored || {};
  const qualityText = Object.keys(NOT_SCORED).filter((key) => key in quality)
    .map((key) => `${NOT_SCORED[key]}: ${quality[key] ? 'yes' : 'no'}`).join(', ');
  const completeness = explanation.data_completeness || {};
  return (
    <div data-testid={historical ? 'historical-explanation' : 'why-this-score'}>
      <p className="text-xs font-semibold mb-2">Why this score?</p>

      {explanation.groups ? (
        <div className="space-y-3">
          {explanation.groups.map((group) => (
            <div key={group.group} data-testid={`group-${group.group}`}>
              <div className="flex justify-between text-xs font-medium">
                <span className="uppercase tracking-wide">{groupLabel(group.group)}</span>
                <span className="tabular-nums">{num(group.earned)} of {num(group.possible)}</span>
              </div>
              {group.rescaled && (
                <p className="text-[11px] text-muted-foreground">Unknown factors are left out; the known ones share these points.</p>
              )}
              {group.below_min_coverage && (
                <p className="text-[11px] text-muted-foreground">Less than half of this group is known, so unknown factors count as 0.</p>
              )}
              <ul className="mt-1.5 space-y-2">
                {group.factors.map((factor) => <FactorRow key={factor.feature} factor={factor} />)}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <ul className="space-y-2">
          {(explanation.factors || []).map((factor) => <FactorRow key={factor.feature} factor={factor} />)}
        </ul>
      )}

      {explanation.turned_off?.length > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {INDICATORS.turned_off.icon} Turned off in your scoring settings: {explanation.turned_off.map(featureLabel).join(', ')}
        </p>
      )}

      <p className="mt-3 text-xs" data-testid="rounding">
        Total {num(explanation.unrounded)} → rounded to <span className="font-semibold">{num(explanation.rounded)}</span>
        {threshold && <span className="text-muted-foreground"> · {threshold}</span>}
      </p>

      <div className="mt-2">
        <DataCompleteness recorded={completeness.recorded} level={completeness.level} suffix=" when calculated" />
      </div>

      {qualityText && <p className="mt-2 text-xs text-muted-foreground">Not scored, contact details: {qualityText}.</p>}

      <SettingsUsed configuration={configuration} methodologyVersion={explanation.methodology_version} />
    </div>
  );
}
