'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { useProjectStore } from '@/store/project-store';

const COLORS = {
  energy: '#3b82f6',
  momentum: '#10b981',
  yarnell: '#f59e0b',
  wspro: '#8b5cf6',
  hecras: '#ef4444',
};

export function SummaryCharts() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;

  // Head loss bar chart data
  const headLossData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { name: p.name };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.totalHeadLoss.toFixed(3));
    }
    return row;
  });

  // WSEL line chart data
  const wselData = flowProfiles.map((p, i) => {
    const row: Record<string, string | number> = { Q: p.discharge };
    for (const m of methods) {
      const r = results[m][i];
      if (r && !r.error) row[m] = parseFloat(r.upstreamWsel.toFixed(2));
    }
    return row;
  });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-medium mb-3">Head Loss Comparison</h3>
        <div className="h-[300px] rounded-lg border p-4 bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={headLossData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
              <YAxis label={{ value: 'Head Loss (ft)', angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }} />
              <Legend />
              {methods.map((m) => (
                <Bar key={m} dataKey={m} fill={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-3">Upstream WSEL vs Discharge</h3>
        <div className="h-[300px] rounded-lg border p-4 bg-card">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={wselData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="Q" label={{ value: 'Discharge (cfs)', position: 'bottom', offset: -5 }} stroke="#71717a" fontSize={12} />
              <YAxis label={{ value: 'US WSEL (ft)', angle: -90, position: 'insideLeft' }} stroke="#71717a" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '6px' }} />
              <Legend />
              {methods.map((m) => (
                <Line key={m} type="monotone" dataKey={m} stroke={COLORS[m]} name={m === 'wspro' ? 'WSPRO' : m.charAt(0).toUpperCase() + m.slice(1)} dot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
