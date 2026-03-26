'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useProjectStore } from '@/store/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const COLORS = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
  hecras: '#ef4444',
};

const tooltipStyle = {
  backgroundColor: 'oklch(0.17 0.01 230)',
  border: '1px solid oklch(0.26 0.02 230)',
  borderRadius: '8px',
};

export function SummaryCharts() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  const headLossData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { name: p.name };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.totalHeadLoss.toFixed(3));
    }
    return row;
  });

  const wselData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { Q: p.discharge };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.upstreamWsel.toFixed(2));
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Head Loss Comparison</CardTitle>
          <CardDescription>Total head loss by method across all flow profiles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={headLossData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 230)" />
                <XAxis dataKey="name" stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <YAxis label={{ value: 'Head Loss (ft)', angle: -90, position: 'insideLeft' }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {methods.map((m) => (
                  <Bar key={m} dataKey={m} fill={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upstream WSEL vs Discharge</CardTitle>
          <CardDescription>Water surface elevation trend across discharge scenarios</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={wselData}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.26 0.02 230)" />
                <XAxis dataKey="Q" label={{ value: 'Discharge (cfs)', position: 'bottom', offset: -5 }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <YAxis label={{ value: 'US WSEL (ft)', angle: -90, position: 'insideLeft' }} stroke="oklch(0.50 0.01 260)" fontSize={12} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                {methods.map((m) => (
                  <Line key={m} type="monotone" dataKey={m} stroke={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} dot={{ r: 4 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
