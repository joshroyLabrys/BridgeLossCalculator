'use client';

import { Sparkles, User, SlidersHorizontal } from 'lucide-react';

export interface ToolAction {
  name: string;
  arguments: Record<string, number>;
}

export interface ChatMessageData {
  role: 'user' | 'assistant';
  content: string;
  toolActions?: ToolAction[];
}

function formatToolLabel(action: ToolAction): string {
  const { name, arguments: args } = action;
  switch (name) {
    case 'adjust_mannings_n':
      return `Manning's n × ${args.multiplier}`;
    case 'adjust_discharge':
      return `Discharge × ${args.multiplier}`;
    case 'adjust_debris':
      return `Debris blockage ${args.percentage}%`;
    case 'adjust_contraction_coeff':
      return `Contraction coeff ${args.value}`;
    case 'adjust_expansion_coeff':
      return `Expansion coeff ${args.value}`;
    case 'reset_overrides':
      return 'Reset to baseline';
    default:
      return name;
  }
}

interface ChatMessageProps {
  message: ChatMessageData;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-end gap-2 justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3.5 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {message.content && (
          <div className="rounded-2xl rounded-tl-sm bg-muted/50 border border-border/50 px-3.5 py-2.5 text-sm leading-relaxed">
            {message.content}
          </div>
        )}
        {message.toolActions && message.toolActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolActions.map((action, i) => (
              <div
                key={i}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs text-primary"
              >
                <SlidersHorizontal className="h-3 w-3 shrink-0" />
                {formatToolLabel(action)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
