'use client';

import { useRef, useState, useEffect } from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import { ChatMessage, type ChatMessageData, type ToolAction } from './chat-message';
import { ChatInput } from './chat-input';
import { useProjectStore } from '@/store/project-store';
import { buildChatContext } from '@/lib/api/ai-chat-prompt';
import type { WhatIfOverrides } from '@/components/what-if/what-if-controls';

const MAX_MESSAGES = 15;

const EXAMPLE_PROMPTS = [
  'What is the head loss for the Q100 event?',
  'What if debris blockage was 30%?',
  'Which flow regime is dominant?',
  'Increase discharge by 20%',
];

interface ChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  overrides: WhatIfOverrides;
  onOverridesChange: (overrides: WhatIfOverrides) => void;
}

export function ChatPanel({ open, onOpenChange, overrides, onOverridesChange }: ChatPanelProps) {
  const crossSection = useProjectStore((s) => s.crossSection);
  const bridgeGeometry = useProjectStore((s) => s.bridgeGeometry);
  const flowProfiles = useProjectStore((s) => s.flowProfiles);
  const coefficients = useProjectStore((s) => s.coefficients);
  const results = useProjectStore((s) => s.results);

  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [userMessageCount, setUserMessageCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function applyToolCall(name: string, args: Record<string, number>): WhatIfOverrides {
    switch (name) {
      case 'adjust_mannings_n':
        return { ...overrides, manningsNMultiplier: args.multiplier };
      case 'adjust_discharge':
        return { ...overrides, dischargeMultiplier: args.multiplier };
      case 'adjust_debris':
        return { ...overrides, debrisBlockagePct: args.percentage };
      case 'adjust_contraction_coeff':
        return { ...overrides, contractionCoeff: args.value };
      case 'adjust_expansion_coeff':
        return { ...overrides, expansionCoeff: args.value };
      case 'reset_overrides':
        return {
          manningsNMultiplier: 1.0,
          debrisBlockagePct: coefficients.debrisBlockagePct,
          contractionCoeff: coefficients.contractionCoeff,
          expansionCoeff: coefficients.expansionCoeff,
          dischargeMultiplier: 1.0,
        };
      default:
        return overrides;
    }
  }

  async function handleSend(text: string) {
    if (streaming || userMessageCount >= MAX_MESSAGES) return;

    const userMsg: ChatMessageData = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setUserMessageCount((c) => c + 1);
    setStreaming(true);

    // Build context from current state + overrides
    const whatIfMap: Record<string, number> = {
      manningsNMultiplier: overrides.manningsNMultiplier,
      debrisBlockagePct: overrides.debrisBlockagePct,
      contractionCoeff: overrides.contractionCoeff,
      expansionCoeff: overrides.expansionCoeff,
      dischargeMultiplier: overrides.dischargeMultiplier,
    };
    const context = buildChatContext(
      crossSection,
      bridgeGeometry,
      flowProfiles,
      coefficients,
      results,
      whatIfMap
    );

    // Add empty assistant placeholder
    const assistantIdx = updatedMessages.length;
    const assistantPlaceholder: ChatMessageData = { role: 'assistant', content: '', toolActions: [] };
    setMessages([...updatedMessages, assistantPlaceholder]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const apiMessages = updatedMessages.map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, context }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = { role: 'assistant', content: `Error: ${err.error ?? 'Unknown error'}` };
          return next;
        });
        return;
      }

      const contentType = res.headers.get('content-type') ?? '';

      // Non-streaming JSON fallback (Codex)
      if (!contentType.includes('text/event-stream')) {
        const data = await res.json() as { type?: string; content?: string; error?: string };
        setMessages((prev) => {
          const next = [...prev];
          next[assistantIdx] = {
            role: 'assistant',
            content: data.content ?? data.error ?? '',
          };
          return next;
        });
        return;
      }

      // SSE streaming
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentOverrides = overrides;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (payload === '[DONE]') break;

          try {
            const event = JSON.parse(payload) as {
              type: string;
              content?: string;
              name?: string;
              arguments?: Record<string, number>;
              message?: string;
            };

            if (event.type === 'text' && event.content) {
              setMessages((prev) => {
                const next = [...prev];
                const msg = next[assistantIdx];
                next[assistantIdx] = { ...msg, content: msg.content + event.content };
                return next;
              });
            } else if (event.type === 'tool_call' && event.name) {
              const action: ToolAction = {
                name: event.name,
                arguments: event.arguments ?? {},
              };
              currentOverrides = applyToolCall(event.name, event.arguments ?? {});
              onOverridesChange(currentOverrides);
              setMessages((prev) => {
                const next = [...prev];
                const msg = next[assistantIdx];
                next[assistantIdx] = {
                  ...msg,
                  toolActions: [...(msg.toolActions ?? []), action],
                };
                return next;
              });
            } else if (event.type === 'error') {
              setMessages((prev) => {
                const next = [...prev];
                const msg = next[assistantIdx];
                next[assistantIdx] = { ...msg, content: msg.content + `\n\nError: ${event.message}` };
                return next;
              });
            }
          } catch {
            // Malformed JSON line — skip
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setMessages((prev) => {
        const next = [...prev];
        next[assistantIdx] = {
          role: 'assistant',
          content: `Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        };
        return next;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function handleClear() {
    abortRef.current?.abort();
    setMessages([]);
    setUserMessageCount(0);
    setStreaming(false);
  }

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 z-50 w-full sm:w-[350px] bg-card border-l border-border/40 shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 shrink-0">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <span className="flex-1 text-sm font-semibold text-foreground">AI Assistant</span>
        <button
          onClick={handleClear}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Clear conversation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onOpenChange(false)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          title="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Ask me about your analysis.</p>
              <p className="text-xs text-muted-foreground">I can explain results and adjust parameters.</p>
            </div>
            <div className="w-full space-y-1.5">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handleSend(prompt)}
                  disabled={streaming}
                  className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} message={msg} />
            ))}
            {streaming && (
              <div className="flex items-center gap-2 pl-9">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0">
        <ChatInput
          onSend={handleSend}
          disabled={streaming}
          messageCount={userMessageCount}
          maxMessages={MAX_MESSAGES}
        />
      </div>
    </div>
  );
}
