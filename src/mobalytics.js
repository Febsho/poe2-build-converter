import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { decodePobCode, parsePobXml } from './pobParser.js';
import { fetchPobbinCode, isPobbinUrl } from './pobbin.js';

const execFileAsync = promisify(execFile);
const MOBALYTICS_HOSTS = ['mobalytics.gg', 'www.mobalytics.gg'];
const GQL_URL = 'https://mobalytics.gg/api/poe-2/v1/graphql/query';

export function isMobalyticsUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input.trim());
    return MOBALYTICS_HOSTS.includes(url.hostname) && url.pathname.includes('/poe-2');
  } catch {
    return false;
  }
}

/**
 * Fetch a Mobalytics PoE2 build by URL, resolve its pobCode (pobb.in URL or
 * raw PoB export), and return a normalized build object.
 */
export async function fetchMobalyticsData(input, opts = {}) {
  const { timeoutMs = 15000, skillSetId, itemSetId, specIndex } = opts;
  const parsed = new URL(input.trim());

  // Extract slug from pathname: /poe-2/builds/<slug>
  const slug = parsed.pathname.replace(/\/+$/, '').split('/').pop();
  if (!slug) throw new Error('Could not extract build slug from Mobalytics URL');

  const pobCode = await fetchPobCodeFromPage(slug, timeoutMs);
  if (!pobCode) {
    throw new Error(
      'No pobb.in link found on this Mobalytics build. Ask the build author to add one.'
    );
  }

  let xml;
  if (isPobbinUrl(pobCode)) {
    const code = await fetchPobbinCode(pobCode, { timeoutMs });
    xml = decodePobCode(code);
  } else {
    xml = decodePobCode(pobCode);
  }

  return parsePobXml(xml, { skillSetId, itemSetId, specIndex });
}

/**
 * Inspect a Mobalytics URL — return available sets for the set selector.
 * Fetches the pobCode and delegates to getAvailableSets.
 */
export async function inspectMobalyticsUrl(input, { timeoutMs = 15000 } = {}) {
  const { getAvailableSets } = await import('./pobParser.js');
  const parsed = new URL(input.trim());
  const slug = parsed.pathname.replace(/\/+$/, '').split('/').pop();
  if (!slug) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };

  try {
    const pobCode = await fetchPobCodeFromPage(slug, timeoutMs);
    if (!pobCode) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };

    let xml;
    if (isPobbinUrl(pobCode)) {
      const code = await fetchPobbinCode(pobCode, { timeoutMs });
      xml = decodePobCode(code);
    } else {
      xml = decodePobCode(pobCode);
    }
    return getAvailableSets(xml);
  } catch {
    return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
  }
}

/**
 * Fetch a Mobalytics build page via curl (bypasses Cloudflare's TLS
 * fingerprint check that blocks Node.js's built-in fetch) and extract
 * the embedded pobb.in URL from the page HTML.
 */
async function fetchPobCodeFromPage(slug, timeoutMs) {
  const url = `https://mobalytics.gg/poe-2/builds/${slug}`;
  const timeoutSec = Math.ceil(timeoutMs / 1000);

  let stdout;
  try {
    ({ stdout } = await execFileAsync('curl', [
      '-sL',
      '--max-time', String(timeoutSec),
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.9',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      url,
    ], { maxBuffer: 10 * 1024 * 1024 }));
  } catch (err) {
    throw new Error(`Failed to fetch Mobalytics page: ${err.message}`);
  }

  // The pobb.in URL is rendered in an <input value="https://pobb.in/..."> element
  const match = stdout.match(/value="(https:\/\/pobb\.in\/[^"]+)"/);
  if (match) return match[1];

  // Also try plain text links in case the markup changes
  const linkMatch = stdout.match(/https:\/\/pobb\.in\/[A-Za-z0-9_-]+/);
  if (linkMatch) return linkMatch[0];

  // Check if the page loaded at all
  if (stdout.includes('Just a moment') || stdout.length < 1000) {
    throw new Error('Mobalytics page blocked by bot protection. Try again in a moment.');
  }

  return null;
}
