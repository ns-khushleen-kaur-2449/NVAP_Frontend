// Jest setup (craco test): jest-dom matchers, and the browser APIs Radix UI needs that jsdom lacks.
import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router 7 needs these; this jsdom does not provide them.
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
// Temporary passwords use window.crypto (every browser has it; this jsdom does not).
if (!window.crypto?.getRandomValues) {
  Object.defineProperty(window, 'crypto', { value: require('crypto').webcrypto, configurable: true });
}

if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
