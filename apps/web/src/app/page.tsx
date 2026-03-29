'use client';

import Link from 'next/link';
import { Waves, Droplets, FileText } from 'lucide-react';

const modules = [
  {
    name: 'Bridge Loss Calculator',
    description: 'Bridge hydraulics, scour, adequacy, QA/QC',
    href: '/blc',
    icon: Waves,
    available: true,
  },
  {
    name: 'Hydrology',
    description: 'Catchment analysis, ARR2019, design floods',
    href: '/hydro',
    icon: Droplets,
    available: false,
  },
  {
    name: 'Report Builder',
    description: 'Cross-module document generation',
    href: '/report',
    icon: FileText,
    available: false,
  },
];

export default function LauncherPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <div className="text-center mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          FlowSuite
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-md">
          Hydraulic engineering tools for bridge waterway assessment
        </p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const content = (
            <div
              className={`relative rounded-xl border p-6 text-center transition-all duration-200 ${
                mod.available
                  ? 'border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                  : 'border-border/30 bg-muted/10 opacity-50 cursor-default'
              }`}
            >
              <Icon className={`h-8 w-8 mx-auto mb-3 ${mod.available ? 'text-primary' : 'text-muted-foreground'}`} />
              <h2 className="font-semibold text-sm text-foreground">{mod.name}</h2>
              <p className="text-xs text-muted-foreground mt-1">{mod.description}</p>
              {!mod.available && (
                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider text-muted-foreground/60 font-medium">
                  Soon
                </span>
              )}
            </div>
          );

          return mod.available ? (
            <Link key={mod.name} href={mod.href}>
              {content}
            </Link>
          ) : (
            <div key={mod.name}>{content}</div>
          );
        })}
      </div>
    </div>
  );
}
