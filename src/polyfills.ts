// Polyfill for crypto.randomUUID() in Node.js CommonJS context
// This fixes an issue with @nestjs/typeorm v11.0.0 where crypto is not available globally
// This file must be imported first in main.ts before any other imports

import * as crypto from 'node:crypto';

if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = {
    randomUUID: () => crypto.randomUUID(),
    getRandomValues: (arr: any) => crypto.getRandomValues(arr),
    subtle: crypto.webcrypto.subtle,
  };
}

