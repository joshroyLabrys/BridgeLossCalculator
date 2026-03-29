import { describe, it, expect } from 'vitest';
import { parseHecRasGeometry, parseHecRasFlow } from '@/lib/hecras-parser';

// ─── Sample geometry text ─────────────────────────────────────────────────────
//
// 11-point cross section with:
//   - 3 Manning's n zones (0.04 left overbank, 0.03 channel, 0.04 right overbank)
//   - Bank stations at 30 (left) and 70 (right)
//
// Bridge with:
//   - Deck high chord = 103, deck width = 10m
//   - 1 low chord point at sta 30 elev 101 and sta 70 elev 101
//   - 1 pier at station 50, width 3
//

const SAMPLE_GEOMETRY = `Geom Title=Test Geometry
River=Test River
Reach=Main

Type RM Length L Ch R = 1 ,500.* ,0 ,500 ,500 ,500
#Sta/Elev= 11
0 ,105
10 ,102
20 ,100
30 ,99
40 ,98
50 ,97
60 ,98
70 ,99
80 ,100
90 ,102
100 ,105
#Mann= 3 , 0 , 0
0 ,0.04 ,0
30 ,0.03 ,0
70 ,0.04 ,0
Bank Sta=30,70

Type RM Length L Ch R = 1 ,400.* ,0 ,500 ,500 ,500
BEGIN BRIDGE: 400.*
Deck/Roadway= 2 ,0,103,103,10,30,101,70,101
Pier #, X Sta, Width= 1 ,50 ,3
END BRIDGE: 400.*
`;

// ─── Sample flow text ─────────────────────────────────────────────────────────
//
// 3 profiles: Q10=100, Q50=500, Q100=1000
// Known WS downstream boundary
//

const SAMPLE_FLOW = `Flow Title=Test Flow
Number of Profiles= 3
Profile Names=Q10,Q50,Q100

River Rch & RM=Test River,Main,500.*
     100      500     1000

Boundary for River Rch & RM=Test River,Main,
Known WS=98.5,99.2,100.1
`;

// ─── Cross-section tests ──────────────────────────────────────────────────────

describe('parseHecRasGeometry – cross section', () => {
  const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
  const xs = result.crossSections[0];

  it('parses title', () => {
    expect(result.title).toBe('Test Geometry');
  });

  it('finds one cross section', () => {
    expect(result.crossSections).toHaveLength(1);
  });

  it('river station is "500.*"', () => {
    expect(xs.riverStation).toBe('500.*');
  });

  it('parses 11 station/elevation points', () => {
    expect(xs.points).toHaveLength(11);
  });

  it('first point is station=0, elevation=105', () => {
    expect(xs.points[0].station).toBe(0);
    expect(xs.points[0].elevation).toBe(105);
  });

  it('last point is station=100, elevation=105', () => {
    expect(xs.points[10].station).toBe(100);
    expect(xs.points[10].elevation).toBe(105);
  });

  it('middle point (station=50) is in the channel zone (n=0.03)', () => {
    const p = xs.points.find((pt) => pt.station === 50)!;
    expect(p.manningsN).toBeCloseTo(0.03);
  });

  it('left overbank point (station=10) has n=0.04', () => {
    const p = xs.points.find((pt) => pt.station === 10)!;
    expect(p.manningsN).toBeCloseTo(0.04);
  });

  it('right overbank point (station=90) has n=0.04', () => {
    const p = xs.points.find((pt) => pt.station === 90)!;
    expect(p.manningsN).toBeCloseTo(0.04);
  });

  it('bank station left = station 30', () => {
    const p = xs.points.find((pt) => pt.station === 30)!;
    expect(p.bankStation).toBe('left');
  });

  it('bank station right = station 70', () => {
    const p = xs.points.find((pt) => pt.station === 70)!;
    expect(p.bankStation).toBe('right');
  });

  it('non-bank points have bankStation = null', () => {
    const p = xs.points.find((pt) => pt.station === 50)!;
    expect(p.bankStation).toBeNull();
  });
});

// ─── Bridge block tests ───────────────────────────────────────────────────────

describe('parseHecRasGeometry – bridge', () => {
  const result = parseHecRasGeometry(SAMPLE_GEOMETRY);
  const bridge = result.bridges[0];

  it('finds one bridge', () => {
    expect(result.bridges).toHaveLength(1);
  });

  it('bridge river station is "400.*"', () => {
    expect(bridge.riverStation).toBe('400.*');
  });

  it('high chord is 103', () => {
    expect(bridge.geometry.highChord).toBe(103);
  });

  it('deck width is 10', () => {
    expect(bridge.geometry.deckWidth).toBe(10);
  });

  it('low chord left elevation is 101', () => {
    expect(bridge.geometry.lowChordLeft).toBe(101);
  });

  it('low chord right elevation is 101', () => {
    expect(bridge.geometry.lowChordRight).toBe(101);
  });

  it('left abutment station is 30', () => {
    expect(bridge.geometry.leftAbutmentStation).toBe(30);
  });

  it('right abutment station is 70', () => {
    expect(bridge.geometry.rightAbutmentStation).toBe(70);
  });

  it('low chord profile has 2 points', () => {
    expect(bridge.geometry.lowChordProfile).toHaveLength(2);
  });

  it('has 1 pier', () => {
    expect(bridge.geometry.piers).toHaveLength(1);
  });

  it('pier station is 50', () => {
    expect(bridge.geometry.piers[0].station).toBe(50);
  });

  it('pier width is 3', () => {
    expect(bridge.geometry.piers[0].width).toBe(3);
  });

  it('pier default shape is "square"', () => {
    expect(bridge.geometry.piers[0].shape).toBe('square');
  });
});

// ─── Flow file tests ──────────────────────────────────────────────────────────

describe('parseHecRasFlow', () => {
  const result = parseHecRasFlow(SAMPLE_FLOW);

  it('parses 3 profiles', () => {
    expect(result.profiles).toHaveLength(3);
  });

  it('profile names are Q10, Q50, Q100', () => {
    expect(result.profiles.map((p) => p.name)).toEqual(['Q10', 'Q50', 'Q100']);
  });

  it('Q10 discharge is 100', () => {
    const p = result.profiles.find((p) => p.name === 'Q10')!;
    expect(p.discharge).toBe(100);
  });

  it('Q50 discharge is 500', () => {
    const p = result.profiles.find((p) => p.name === 'Q50')!;
    expect(p.discharge).toBe(500);
  });

  it('Q100 discharge is 1000', () => {
    const p = result.profiles.find((p) => p.name === 'Q100')!;
    expect(p.discharge).toBe(1000);
  });

  it('Q10 downstream WSEL is 98.5', () => {
    const p = result.profiles.find((p) => p.name === 'Q10')!;
    expect(p.dsWsel).toBeCloseTo(98.5);
  });

  it('Q50 downstream WSEL is 99.2', () => {
    const p = result.profiles.find((p) => p.name === 'Q50')!;
    expect(p.dsWsel).toBeCloseTo(99.2);
  });

  it('Q100 downstream WSEL is 100.1', () => {
    const p = result.profiles.find((p) => p.name === 'Q100')!;
    expect(p.dsWsel).toBeCloseTo(100.1);
  });

  it('ari mirrors profile name', () => {
    expect(result.profiles[0].ari).toBe('Q10');
  });

  it('channelSlope defaults to 0 when no Normal Depth line', () => {
    expect(result.profiles[0].channelSlope).toBe(0);
  });
});

// ─── Normal Depth boundary test ───────────────────────────────────────────────

describe('parseHecRasFlow – Normal Depth boundary', () => {
  const flowWithSlope = `Flow Title=Slope Test
Number of Profiles= 2
Profile Names=Q10,Q100

River Rch & RM=Test River,Main,500.*
     200     1000

Boundary for River Rch & RM=Test River,Main,
Normal Depth=0.001,0.002
`;

  const result = parseHecRasFlow(flowWithSlope);

  it('parses Normal Depth as channelSlope', () => {
    expect(result.profiles[0].channelSlope).toBeCloseTo(0.001);
    expect(result.profiles[1].channelSlope).toBeCloseTo(0.002);
  });

  it('dsWsel defaults to 0 when no Known WS', () => {
    expect(result.profiles[0].dsWsel).toBe(0);
  });
});
