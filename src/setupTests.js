import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'util';

// react-router 7 needs these; the jsdom bundled with CRA's Jest does not provide them.
if (!global.TextEncoder) global.TextEncoder = TextEncoder;
if (!global.TextDecoder) global.TextDecoder = TextDecoder;
