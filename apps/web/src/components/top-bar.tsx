'use client';

import { useRef } from 'react';
import { Button } from '@flowsuite/ui';
import { useProjectStore } from '@/store/project-store';
import { UnitSystem } from '@flowsuite/data';
import { Waves, Upload, Download, Ruler } from 'lucide-react';

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-border/40 bg-card/80 backdrop-blur-xl shadow-sm">
      <div className="flex items-center gap-2.5">
        <Waves className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold tracking-tight text-foreground">Bridge Loss Calculator</h1>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-muted/40 px-1 py-0.5">
          <Ruler className="h-3.5 w-3.5 text-muted-foreground ml-2" />
          <button
            onClick={() => setUnitSystem('metric')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${unitSystem === 'metric' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Metric
          </button>
          <button
            onClick={() => setUnitSystem('imperial')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${unitSystem === 'imperial' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            Imperial
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          className="hidden"
        />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1.5" />
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1.5" />
          Export
        </Button>
      </div>
    </header>
  );
}
