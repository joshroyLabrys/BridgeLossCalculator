'use client';

import { useProjectStore } from '@/store/project-store';
import { Badge } from '@/components/ui/badge';

const regimeStyle = {
  'free-surface': { label: 'F', className: 'bg-blue-900/50 text-blue-300' },
  'pressure': { label: 'P', className: 'bg-orange-900/50 text-orange-300' },
  'overtopping': { label: 'O', className: 'bg-purple-900/50 text-purple-300' },
};

export function RegimeMatrix() {
  const results = useProjectStore((s) => s.results);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);

  if (!results) return null;

  const methods = ['energy', 'momentum', 'yarnell', 'wspro'] as const;
  const profileNames = flowProfiles.map((p) => p.name);

  return (
    <div>
      <h3 className="text-sm font-medium mb-2">Flow Regime Matrix</h3>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Method</th>
              {profileNames.map((n) => <th key={n} className="p-2 text-center">{n}</th>)}
            </tr>
          </thead>
          <tbody>
            {methods.map((method) => (
              <tr key={method} className="border-t">
                <td className="p-2 capitalize">{method === 'wspro' ? 'WSPRO' : method}</td>
                {results[method].map((r, i) => {
                  const style = regimeStyle[r.flowRegime];
                  return (
                    <td key={i} className="p-2 text-center">
                      <Badge className={`text-xs ${style.className}`}>{style.label}</Badge>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
