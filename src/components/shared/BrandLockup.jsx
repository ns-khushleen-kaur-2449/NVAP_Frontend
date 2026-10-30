import netsmartzOnLight from '@/assets/netsmartz-27-on-light.png';
import netsmartzOnDark from '@/assets/netsmartz-27-on-dark.png';
import { cn } from '@/lib/utils';

/*
 * SmartSDR brand lockup: the Netsmartz "27 years" logo (parent brand) paired
 * with the SmartSDR wordmark (product).
 *
 *   layout="inline"   Netsmartz logo │ SmartSDR    — navbars, footer
 *   layout="stacked"  Netsmartz logo / SmartSDR   — login, app sidebar
 *
 * tone="auto" follows the theme (dark logo text on light surfaces, white on
 * dark). tone="onDark" forces the white logo for surfaces that stay dark in
 * both themes, such as the navbar over the hero.
 */

const LOGO_ALT = 'Netsmartz — celebrating 27 years';
// Intrinsic size of both logo files. Passed as width/height so the browser knows
// the aspect ratio before the image loads; CSS (a height class + width:auto) sets
// the rendered size.
const LOGO_W = 860;
const LOGO_H = 198;
// Where the "netsmartz" lettering starts (x px in the 860×198 file), right after
// the square mark. The stacked lockup indents SmartSDR to this line.
const LOGO_WORDMARK_X = 127;

// Size the logo with a height class only. width:auto keeps the natural ratio,
// and object-contain plus max-w-full keep it undistorted and inside its parent
// even when a flex parent stretches or narrows the box.
export function NetsmartzLogo({ tone = 'auto', className }) {
  const base = cn('w-auto max-w-full object-contain select-none', className);
  const img = (src, extra, decorative) => (
    <img src={src} width={LOGO_W} height={LOGO_H} draggable={false} className={cn(base, extra)}
      alt={decorative ? '' : LOGO_ALT} aria-hidden={decorative ? 'true' : undefined} />
  );
  if (tone === 'onDark') return img(netsmartzOnDark);
  return (
    <>
      {img(netsmartzOnLight, 'dark:hidden')}
      {img(netsmartzOnDark, 'hidden dark:block', true)}
    </>
  );
}

// The square figure-and-star mark alone, cropped from the full logo (it is the
// same in both logo variants). The mark occupies x 0–120, y 47–155 of the
// 860×198 source; the background is scaled so that box fills `size` px height.
export function NetsmartzMark({ size = 32, className }) {
  const scale = size / 109;
  return (
    <span
      role="img"
      aria-label="Netsmartz"
      className={cn('inline-block shrink-0 bg-no-repeat', className)}
      style={{
        width: Math.round(120 * scale),
        height: size,
        backgroundImage: `url(${netsmartzOnLight})`,
        backgroundSize: `${860 * scale}px auto`,
        backgroundPosition: `0 ${-47 * scale}px`,
      }}
    />
  );
}

export function SmartSDRWordmark({ className, style }) {
  return (
    <span style={style} className={cn('mk-display font-semibold leading-none tracking-tight whitespace-nowrap', className)}>
      Smart<span className="text-[var(--pine)]">SDR</span>
    </span>
  );
}

const INLINE_SIZES = {
  sm: { logo: 'h-6', divider: 'h-5', word: 'text-[1.05rem]', gap: 'gap-2.5' },
  md: { logo: 'h-9', divider: 'h-7', word: 'text-[1.4rem]', gap: 'gap-3' },
  lg: { logo: 'h-10', divider: 'h-8', word: 'text-[1.7rem]', gap: 'gap-4' },
};

// logoPx mirrors the logo height class so the wordmark indent can be computed.
const STACKED_SIZES = {
  sm: { logo: 'h-9', logoPx: 36, word: 'text-[1.15rem]', gap: 'gap-1.5' },
  md: { logo: 'h-10', logoPx: 40, word: 'text-[1.5rem]', gap: 'gap-2' },
  lg: { logo: 'h-12', logoPx: 48, word: 'text-[1.9rem]', gap: 'gap-2.5' },
  xl: { logo: 'h-16', logoPx: 64, word: 'text-[2.25rem]', gap: 'gap-3' },
};

// Stacked wordAlign: "letters" starts SmartSDR where the "netsmartz" letters
// start (not under the square mark); "end" right-aligns it with the logo's edge.
export default function BrandLockup({ layout = 'inline', size = 'md', tone = 'auto', wordAlign = 'letters', className, wordClassName }) {
  if (layout === 'stacked') {
    const s = STACKED_SIZES[size];
    const alignEnd = wordAlign === 'end';
    const indent = alignEnd ? 0 : Math.round((s.logoPx * LOGO_WORDMARK_X) / LOGO_H);
    return (
      <span className={cn('inline-flex flex-col', alignEnd ? 'items-end' : 'items-start', s.gap, className)}>
        {/* The logo stays left; with "end", a full-width lockup pushes SmartSDR to the far right. */}
        <NetsmartzLogo tone={tone} className={cn(s.logo, 'self-start')} />
        <SmartSDRWordmark className={cn(s.word, wordClassName)} style={indent ? { marginLeft: indent } : undefined} />
      </span>
    );
  }
  const s = INLINE_SIZES[size];
  // The wordmark is centred on the "netsmartz" letters rather than the full
  // logo box (which includes "SINCE 1999" below), so it sits a touch higher.
  return (
    <span className={cn('inline-flex items-center', s.gap, className)}>
      <NetsmartzLogo tone={tone} className={s.logo} />
      <span aria-hidden="true" className={cn('w-px shrink-0 bg-current opacity-25', s.divider)} />
      <SmartSDRWordmark className={cn(s.word, '-translate-y-[2px]', wordClassName)} />
    </span>
  );
}
