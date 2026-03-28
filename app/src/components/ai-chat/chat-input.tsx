'use client';

import { useRef, useState } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
  messageCount: number;
  maxMessages: number;
}

export function ChatInput({ onSend, disabled, messageCount, maxMessages }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const atLimit = messageCount >= maxMessages;

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled || atLimit) return;
    onSend(trimmed);
    setValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (atLimit) {
    return (
      <div className="border-t border-border/40 px-3 py-3">
        <p className="text-xs text-amber-400 font-medium text-center">
          Message limit reached ({messageCount}/{maxMessages})
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-border/40 px-3 pt-3 pb-2 space-y-1.5">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Ask about your bridge analysis…"
          className="flex-1 resize-none rounded-xl border border-border/50 bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-opacity hover:bg-primary/90 disabled:opacity-40"
          title="Send"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-[10px] text-muted-foreground">{messageCount}/{maxMessages} messages</span>
        <span className="text-[10px] text-muted-foreground">Shift+Enter for new line</span>
      </div>
    </div>
  );
}
