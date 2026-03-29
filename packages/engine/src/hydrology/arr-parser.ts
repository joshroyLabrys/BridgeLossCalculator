// packages/engine/src/hydrology/arr-parser.ts
import type { ARRDataHubOutput, ARRSiteDetails, ARRIFDData, ARRTemporalPattern, ARRArealReductionFactors, ARRLosses } from './types';

export function parseARRDataHub(text: string): ARRDataHubOutput {
  const warnings: string[] = [];
  const lines = text.split(/\r?\n/);

  // Find section boundaries
  const sections = new Map<string, string[]>();
  let currentSection = '';
  for (const line of lines) {
    const sectionMatch = line.match(/^\[(.+)\]\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim();
      sections.set(currentSection, []);
    } else if (currentSection && line.trim()) {
      sections.get(currentSection)!.push(line.trim());
    }
  }

  const siteDetails = parseSiteDetails(sections.get('Site Details') ?? [], warnings);
  const ifd = parseIFD(sections.get('IFD Depths') ?? [], warnings);
  const temporalPatterns = parseTemporalPatterns(sections.get('Temporal Patterns') ?? [], warnings);
  const arf = parseARF(sections.get('Areal Reduction Factors') ?? [], warnings);
  const losses = parseLosses(sections.get('Losses') ?? [], warnings);

  if (!sections.has('IFD Depths')) warnings.push('Missing [IFD Depths] section');
  if (!sections.has('Temporal Patterns')) warnings.push('Missing [Temporal Patterns] section');
  if (!sections.has('Losses')) warnings.push('Missing [Losses] section');

  return { siteDetails, ifd, temporalPatterns, arf, losses, warnings };
}

function parseSiteDetails(lines: string[], warnings: string[]): ARRSiteDetails {
  let lat = 0, lng = 0, name = '';
  for (const line of lines) {
    const kv = line.match(/^(.+?):\s*(.+)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (/latitude/i.test(key)) lat = parseFloat(val) || 0;
    else if (/longitude/i.test(key)) lng = parseFloat(val) || 0;
    else if (/location|name/i.test(key)) name = val;
  }
  if (lat === 0 && lng === 0) warnings.push('Could not parse site coordinates');
  return { lat, lng, name };
}

function parseIFD(lines: string[], warnings: string[]): ARRIFDData {
  if (lines.length < 2) return { durations: [], aeps: [], depths: [] };

  // First line is header: Duration,50%,20%,...
  const headerParts = lines[0].split(',').map(s => s.trim());
  const aeps = headerParts.slice(1);
  const durations: number[] = [];
  const depths: number[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const durMatch = parts[0].match(/([\d.]+)\s*(min|hr|hour)/i);
    if (!durMatch) continue;
    let durMin = parseFloat(durMatch[1]);
    if (/hr|hour/i.test(durMatch[2])) durMin *= 60;
    durations.push(durMin);
    depths.push(parts.slice(1).map(v => parseFloat(v) || 0));
  }

  return { durations, aeps, depths };
}

function parseTemporalPatterns(lines: string[], warnings: string[]): ARRTemporalPattern[] {
  const patterns: ARRTemporalPattern[] = [];
  let currentGroup: ARRTemporalPattern['group'] = 'frequent';
  let currentDuration = 0;
  let currentPatterns: number[][] = [];

  function flush() {
    if (currentPatterns.length > 0 && currentDuration > 0) {
      patterns.push({ group: currentGroup, durationMin: currentDuration, patterns: [...currentPatterns] });
      currentPatterns = [];
    }
  }

  for (const line of lines) {
    const groupMatch = line.match(/AEP\s+Group:\s*(\w+)/i);
    if (groupMatch) {
      flush();
      const g = groupMatch[1].toLowerCase();
      if (g === 'frequent') currentGroup = 'frequent';
      else if (g === 'infrequent') currentGroup = 'infrequent';
      else if (g === 'rare') currentGroup = 'rare';
      continue;
    }

    const durMatch = line.match(/Duration:\s*([\d.]+)\s*(min|hr|hour)/i);
    if (durMatch) {
      flush();
      currentDuration = parseFloat(durMatch[1]);
      if (/hr|hour/i.test(durMatch[2])) currentDuration *= 60;
      continue;
    }

    const patMatch = line.match(/Pattern\s+\d+:\s*(.+)/i);
    if (patMatch) {
      const fractions = patMatch[1].split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
      if (fractions.length > 0) currentPatterns.push(fractions);
    }
  }
  flush();

  if (patterns.length === 0) warnings.push('No temporal patterns parsed');
  return patterns;
}

function parseARF(lines: string[], warnings: string[]): ARRArealReductionFactors {
  if (lines.length < 2) return { durations: [], aeps: [], factors: [] };
  const headerParts = lines[0].split(',').map(s => s.trim());
  const aeps = headerParts.slice(1);
  const durations: number[] = [];
  const factors: number[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(s => s.trim());
    if (parts.length < 2) continue;
    const durMatch = parts[0].match(/([\d.]+)\s*(min|hr|hour)/i);
    if (!durMatch) continue;
    let durMin = parseFloat(durMatch[1]);
    if (/hr|hour/i.test(durMatch[2])) durMin *= 60;
    durations.push(durMin);
    factors.push(parts.slice(1).map(v => parseFloat(v) || 1.0));
  }

  return { durations, aeps, factors };
}

function parseLosses(lines: string[], warnings: string[]): ARRLosses {
  let initialLoss = 0;
  let continuingLoss = 0;
  const preBurst: ARRLosses['preBurst'] = [];

  for (const line of lines) {
    const ilMatch = line.match(/Initial\s+Loss.*?:\s*([\d.]+)/i);
    if (ilMatch) { initialLoss = parseFloat(ilMatch[1]); continue; }

    const clMatch = line.match(/Continuing\s+Loss.*?:\s*([\d.]+)/i);
    if (clMatch) { continuingLoss = parseFloat(clMatch[1]); continue; }

    const pbMatch = line.match(/Pre-burst\s*\((\d+%?),?\s*([\d.]+)\s*(min|hr|hour)\):\s*([\d.]+)/i);
    if (pbMatch) {
      let dur = parseFloat(pbMatch[2]);
      if (/hr|hour/i.test(pbMatch[3])) dur *= 60;
      preBurst.push({ aep: pbMatch[1], durationMin: dur, depth: parseFloat(pbMatch[4]) });
    }
  }

  if (initialLoss === 0 && continuingLoss === 0) warnings.push('Could not parse loss values');
  return { initialLoss, continuingLoss, preBurst };
}
