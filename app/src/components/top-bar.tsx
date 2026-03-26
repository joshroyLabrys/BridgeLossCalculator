'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useProjectStore } from '@/store/project-store';

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportProject = useProjectStore((s) => s.exportProject);
  const importProject = useProjectStore((s) => s.importProject);
  const unitSystem = useProjectStore((s) => s.unitSystem);
  const setUnitSystem = useProjectStore((s) => s.setUnitSystem);

  function handleExport() {
    const json = exportProject();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bridge-loss-project.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importProject(reader.result as string);
      } catch (err) {
        alert(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b">
      <h1 className="text-lg font-semibold">Bridge Loss Calculator</h1>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={unitSystem === 'imperial' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUnitSystem('imperial')}
          >
            Imperial
          </Button>
          <Button
            variant={unitSystem === 'metric' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setUnitSystem('metric')}
          >
            Metric
          </Button>
        </div>
        <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          Import JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          Export JSON
        </Button>
        </div>
      </div>
    </header>
  );
}
