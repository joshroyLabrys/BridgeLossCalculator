import type { CrossSectionPoint, BridgeGeometry, LowChordPoint, Pier } from '@flowsuite/engine/types';

// ─── Exported result types ────────────────────────────────────────────────────

export interface ParsedCrossSection {
  riverStation: string;
  points: CrossSectionPoint[];
}

export interface ParsedBridge {
  riverStation: string;
  geometry: Omit<BridgeGeometry, 'contractionLength' | 'expansionLength' | 'orificeCd' | 'weirCw'>;
}

export interface HecRasGeometryResult {
  crossSections: ParsedCrossSection[];
  bridges: ParsedBridge[];
  title: string;
}

export interface HecRasFlowResult {
  profiles: Array<{
    name: string;
    ari: string;
    discharge: number;
    dsWsel: number;
    channelSlope: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nums(s: string): number[] {
  return s
    .trim()
    .split(/[\s,]+/)
    .filter((t) => t.length > 0)
    .map(Number)
    .filter((n) => !isNaN(n));
}

function splitCSV(s: string): string[] {
  return s.split(',').map((t) => t.trim());
}

// ─── Geometry parser ──────────────────────────────────────────────────────────

export function parseHecRasGeometry(text: string): HecRasGeometryResult {
  const lines = text.split(/\r?\n/);
  let i = 0;

  const result: HecRasGeometryResult = { title: '', crossSections: [], bridges: [] };

  // Parse title (first non-blank line that starts with "Geom Title=")
  for (const line of lines) {
    if (line.startsWith('Geom Title=')) {
      result.title = line.slice('Geom Title='.length).trim();
      break;
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // ── River station identifier ──────────────────────────────────────────────
    // Type RM Length L Ch R = 1 ,500.* ,0 ,500 ,500 ,500
    if (line.startsWith('Type RM Length L Ch R =')) {
      const parts = splitCSV(line.slice('Type RM Length L Ch R ='.length));
      const riverStation = parts[1] ?? '';

      // Look ahead: is the next XS block or a bridge block?
      i++;
      // Consume blank/comment lines up to next substantive line
      while (i < lines.length && lines[i].trim() === '') i++;

      // Check whether we're entering a bridge block
      if (i < lines.length && lines[i].startsWith('BEGIN BRIDGE:')) {
        // Parse bridge
        const bridge = parseBridgeBlock(lines, i, riverStation);
        result.bridges.push(bridge.parsed);
        i = bridge.nextLine;
      } else {
        // Parse cross section
        const xs = parseCrossSection(lines, i, riverStation);
        result.crossSections.push(xs.parsed);
        i = xs.nextLine;
      }
      continue;
    }

    i++;
  }

  return result;
}

// ─── Cross-section parser ─────────────────────────────────────────────────────

interface ParseResult<T> {
  parsed: T;
  nextLine: number;
}

function parseCrossSection(
  lines: string[],
  startLine: number,
  riverStation: string
): ParseResult<ParsedCrossSection> {
  let i = startLine;
  const staElev: Array<[number, number]> = [];
  let bankLeft: number | null = null;
  let bankRight: number | null = null;

  // Manning's n triplets: [station, n-value, 0]
  const mannTriplets: Array<[number, number]> = []; // [station, n]

  while (i < lines.length) {
    const line = lines[i];

    // Stop when we hit the next section
    if (
      line.startsWith('Type RM Length L Ch R =') ||
      line.startsWith('BEGIN BRIDGE:') ||
      line.startsWith('END BRIDGE:')
    ) {
      break;
    }

    // Station/Elevation pairs
    const staElevMatch = line.match(/^#Sta\/Elev=\s*(\d+)/);
    if (staElevMatch) {
      const count = parseInt(staElevMatch[1], 10);
      // Read following lines, each up to 5 pairs
      let collected = 0;
      i++;
      while (collected < count && i < lines.length) {
        const dataLine = lines[i];
        const values = nums(dataLine);
        for (let k = 0; k + 1 < values.length; k += 2) {
          staElev.push([values[k], values[k + 1]]);
          collected++;
          if (collected >= count) break;
        }
        i++;
      }
      continue;
    }

    // Manning's n
    const mannMatch = line.match(/^#Mann=\s*(\d+)\s*,/);
    if (mannMatch) {
      const count = parseInt(mannMatch[1], 10);
      let collected = 0;
      i++;
      while (collected < count && i < lines.length) {
        const dataLine = lines[i];
        const values = nums(dataLine);
        // triplets: station, n, 0
        for (let k = 0; k + 2 < values.length; k += 3) {
          mannTriplets.push([values[k], values[k + 1]]);
          collected++;
          if (collected >= count) break;
        }
        i++;
      }
      continue;
    }

    // Bank stations
    const bankMatch = line.match(/^Bank Sta=\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (bankMatch) {
      bankLeft = parseFloat(bankMatch[1]);
      bankRight = parseFloat(bankMatch[2]);
      i++;
      continue;
    }

    i++;
  }

  // Build CrossSectionPoint[]
  // Sort Manning's triplets by station ascending
  mannTriplets.sort((a, b) => a[0] - b[0]);

  // Determine Manning's n for each station using step-function:
  // n = first zone's value until next zone station is reached
  function getManningsN(station: number): number {
    if (mannTriplets.length === 0) return 0.03; // fallback
    let n = mannTriplets[0][1];
    for (const [mSta, mN] of mannTriplets) {
      if (station >= mSta) n = mN;
      else break;
    }
    return n;
  }

  const points: CrossSectionPoint[] = staElev.map(([station, elevation]) => {
    let bankStation: 'left' | 'right' | null = null;
    if (bankLeft !== null && station === bankLeft) bankStation = 'left';
    if (bankRight !== null && station === bankRight) bankStation = 'right';
    return {
      station,
      elevation,
      manningsN: getManningsN(station),
      bankStation,
    };
  });

  return {
    parsed: { riverStation, points },
    nextLine: i,
  };
}

// ─── Bridge block parser ──────────────────────────────────────────────────────

function parseBridgeBlock(
  lines: string[],
  startLine: number,
  riverStation: string
): ParseResult<ParsedBridge> {
  let i = startLine;

  // Defaults
  let highChord = 0;
  let deckWidth = 0;
  let leftAbutmentStation = 0;
  let rightAbutmentStation = 0;
  let lowChordProfile: LowChordPoint[] = [];
  let lowChordLeft = 0;
  let lowChordRight = 0;
  const piers: Pier[] = [];

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('END BRIDGE:')) {
      i++;
      break;
    }

    // Deck/Roadway= N ,upDist, highChordUS, highChordDS, deckWidth, then station/elev pairs
    // e.g. Deck/Roadway= 1 ,0,103,103,10,30,101,70,101
    const deckMatch = line.match(/^Deck\/Roadway=\s*([\d]+)\s*,(.+)/);
    if (deckMatch) {
      const count = parseInt(deckMatch[1], 10);
      const rest = nums(deckMatch[2]);
      // rest[0] = upstream dist, rest[1] = highChordUS, rest[2] = highChordDS, rest[3] = deckWidth
      // then count pairs of (station, elevation) for low chord
      highChord = rest[1] ?? 0; // use upstream high chord
      deckWidth = rest[3] ?? 0;

      // Low chord profile pairs start at index 4
      lowChordProfile = [];
      for (let k = 0; k < count; k++) {
        const idx = 4 + k * 2;
        if (idx + 1 < rest.length) {
          lowChordProfile.push({ station: rest[idx], elevation: rest[idx + 1] });
        }
      }
      if (lowChordProfile.length > 0) {
        lowChordLeft = lowChordProfile[0].elevation;
        lowChordRight = lowChordProfile[lowChordProfile.length - 1].elevation;
        leftAbutmentStation = lowChordProfile[0].station;
        rightAbutmentStation = lowChordProfile[lowChordProfile.length - 1].station;
      }

      i++;
      continue;
    }

    // Pier #, X Sta, Width= 1 ,50 ,3
    const pierMatch = line.match(/^Pier\s+#,\s*X Sta,\s*Width=\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (pierMatch) {
      piers.push({
        station: parseFloat(pierMatch[2]),
        width: parseFloat(pierMatch[3]),
        shape: 'square', // default; not encoded in basic HEC-RAS g01
      });
      i++;
      continue;
    }

    i++;
  }

  const geometry: ParsedBridge['geometry'] = {
    highChord,
    deckWidth,
    lowChordLeft,
    lowChordRight,
    leftAbutmentStation,
    rightAbutmentStation,
    skewAngle: 0,
    piers,
    lowChordProfile,
  };

  return {
    parsed: { riverStation, geometry },
    nextLine: i,
  };
}

// ─── Results file parser (.r01) ───────────────────────────────────────────

export interface HecRasResultsProfile {
  profileName: string;
  upstreamWsel: number | null;
  headLoss: number | null;
  velocity: number | null;
  froude: number | null;
}

export function parseHecRasResults(text: string): HecRasResultsProfile[] {
  try {
    const lines = text.split(/\r?\n/);
    const profiles: HecRasResultsProfile[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // Look for "Begin Profile Output" blocks
      if (/Begin\s+Profile\s+Output/i.test(line)) {
        const profile: HecRasResultsProfile = {
          profileName: '',
          upstreamWsel: null,
          headLoss: null,
          velocity: null,
          froude: null,
        };

        i++;
        // Scan the block until we hit "End Profile Output" or another section
        while (i < lines.length) {
          const bline = lines[i];

          if (/End\s+Profile\s+Output/i.test(bline)) {
            i++;
            break;
          }

          // Profile name
          const nameMatch = bline.match(/Profile\s*[:=]\s*(.+)/i);
          if (nameMatch && !profile.profileName) {
            profile.profileName = nameMatch[1].trim();
          }

          // W.S. Elev
          const wselMatch = bline.match(/W\.?S\.?\s*Elev\s*[:=]\s*([\d.+-]+)/i);
          if (wselMatch) {
            profile.upstreamWsel = parseFloat(wselMatch[1]);
          }

          // E.G. Elev (can derive head loss from W.S. and E.G. difference)
          const eglMatch = bline.match(/E\.?G\.?\s*Elev\s*[:=]\s*([\d.+-]+)/i);
          if (eglMatch && profile.upstreamWsel !== null) {
            const egl = parseFloat(eglMatch[1]);
            if (!isNaN(egl)) {
              profile.headLoss = Math.abs(egl - profile.upstreamWsel);
            }
          }

          // Velocity
          const velMatch = bline.match(/Vel\s*(?:Chnl|Total)?\s*[:=]\s*([\d.+-]+)/i);
          if (velMatch) {
            profile.velocity = parseFloat(velMatch[1]);
          }

          // Froude
          const frMatch = bline.match(/Froude\s*(?:#|Num)?\s*(?:Chl)?\s*[:=]\s*([\d.+-]+)/i);
          if (frMatch) {
            profile.froude = parseFloat(frMatch[1]);
          }

          i++;
        }

        if (profile.profileName) {
          profiles.push(profile);
        }
        continue;
      }

      i++;
    }

    return profiles;
  } catch {
    return [];
  }
}

// ─── Flow file parser ─────────────────────────────────────────────────────────

export function parseHecRasFlow(text: string): HecRasFlowResult {
  const lines = text.split(/\r?\n/);

  let profileNames: string[] = [];
  let numProfiles = 0;
  const dischargesByProfile: number[] = [];
  const dsWselByProfile: number[] = [];
  const channelSlopeByProfile: number[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Number of profiles
    const numMatch = line.match(/^Number of Profiles=\s*(\d+)/);
    if (numMatch) {
      numProfiles = parseInt(numMatch[1], 10);
      i++;
      continue;
    }

    // Profile names
    if (line.startsWith('Profile Names=')) {
      const raw = line.slice('Profile Names='.length);
      profileNames = splitCSV(raw).filter((n) => n.length > 0);
      i++;
      continue;
    }

    // River Rch & RM= followed by discharge rows
    if (line.startsWith('River Rch & RM=')) {
      // Next lines have discharge values (one value per profile per line, up to 10 per line)
      i++;
      let collected = 0;
      while (collected < numProfiles && i < lines.length) {
        const dataLine = lines[i];
        // Stop if we hit a new section keyword
        if (/^[A-Za-z]/.test(dataLine) && !dataLine.match(/^\s*[-\d]/)) {
          // Could be next keyword — check if it looks like numbers
          const values = nums(dataLine);
          if (values.length === 0) break;
          for (const v of values) {
            dischargesByProfile.push(v);
            collected++;
            if (collected >= numProfiles) break;
          }
        } else {
          const values = nums(dataLine);
          if (values.length === 0) {
            // blank line — keep going if not done
            i++;
            continue;
          }
          for (const v of values) {
            dischargesByProfile.push(v);
            collected++;
            if (collected >= numProfiles) break;
          }
        }
        i++;
      }
      continue;
    }

    // Known WS= (downstream WSEL boundary)
    if (line.startsWith('Known WS=')) {
      const raw = line.slice('Known WS='.length);
      const values = nums(raw);
      for (const v of values) dsWselByProfile.push(v);
      i++;
      continue;
    }

    // Normal Depth= (channel slope boundary)
    if (line.startsWith('Normal Depth=')) {
      const raw = line.slice('Normal Depth='.length);
      const values = nums(raw);
      for (const v of values) channelSlopeByProfile.push(v);
      i++;
      continue;
    }

    i++;
  }

  const profiles = profileNames.map((name, idx) => ({
    name,
    ari: name,
    discharge: dischargesByProfile[idx] ?? 0,
    dsWsel: dsWselByProfile[idx] ?? 0,
    channelSlope: channelSlopeByProfile[idx] ?? 0,
  }));

  return { profiles };
}
