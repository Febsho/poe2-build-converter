#!/usr/bin/env node
import { getDataStatus } from '../src/data/status.js';

const { summary, categories } = await getDataStatus();

console.log('\nPoE2 Data Status');
console.log('================');
for (const [key, cat] of Object.entries(categories)) {
  const icon = cat.status === 'ok' || cat.status === 'bundled' ? '✓' : cat.status === 'stale' ? '~' : '✗';
  console.log(`  ${icon} ${cat.label.padEnd(25)} ${cat.message}`);
}
console.log('');
console.log(summary.message);
console.log('');
