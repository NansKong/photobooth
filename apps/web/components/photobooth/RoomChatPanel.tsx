'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { ChatMessage } from '@photobooth/shared';
import { MessageCircle, Send, X } from 'lucide-react';

interface RoomChatPanelProps {
  messages: ChatMessage[];
  selfParticipantId: string | null;
  onSendMessage: (text: string) => boolean;
  canChat: boolean;
  context: 'camera' | 'review';
  className?: string;
  onClose?: () => void;
}

export function RoomChatPanel({
  messages,
  selfParticipantId,
  onSendMessage,
  canChat,
  context,
  className = '',
  onClose,
}: RoomChatPanelProps) {
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (onSendMessage(draft)) setDraft('');
  }

  return (
    <section aria-label="Room chat" className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-[#282A2B] bg-[#F4EFE6] text-[#282A2B] shadow-retro-sm ${className}`}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[#282A2B]/20 bg-[#EBE4D5] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#D67C65]" />
          <div>
            <h3 className="font-retro text-sm font-bold">Room chat</h3>
            <p className="font-mono text-[10px] text-[#282A2B]/60">{context === 'camera' ? 'Plan your next pose together' : 'Talk stickers, frames & favorites'}</p>
          </div>
        </div>
        {onClose && <button type="button" onClick={onClose} aria-label="Close chat" className="rounded-lg p-1 hover:bg-white"><X className="h-4 w-4" /></button>}
      </div>
      <div role="log" aria-live="polite" aria-relevant="additions" className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 font-mono text-xs">
        {messages.length === 0 && (
          <p className="rounded-xl border border-dashed border-[#282A2B]/25 bg-white/60 p-3 leading-relaxed text-[#282A2B]/65">
            {context === 'camera' ? 'Say when you are ready, or suggest the next pose.' : 'Share ideas for stickers, filters, or the final strip.'}
          </p>
        )}
        {messages.map((message) => {
          const mine = message.participantId === selfParticipantId;
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[92%] rounded-xl px-2.5 py-2 ${mine ? 'bg-[#D67C65] text-white' : 'border border-[#282A2B]/15 bg-white'}`}>
                <div className={`mb-0.5 flex items-center gap-2 text-[10px] font-bold ${mine ? 'text-white/85' : 'text-[#282A2B]/65'}`}>
                  <span className="truncate">{mine ? 'You' : message.name}</span>
                  <time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time>
                </div>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-[#282A2B]/20 bg-white/70 p-2">
        <label htmlFor={context === 'camera' ? 'camera-chat-input' : 'review-chat-input'} className="sr-only">Message the room</label>
        <input
          id={context === 'camera' ? 'camera-chat-input' : 'review-chat-input'}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={500}
          disabled={!canChat}
          placeholder={canChat ? 'Message the room...' : 'Connecting to room...'}
          className="min-w-0 flex-1 rounded-xl border border-[#282A2B]/30 bg-white px-2.5 py-2 font-mono text-xs outline-none focus:border-[#D67C65] disabled:opacity-60"
        />
        <button type="submit" disabled={!canChat || !draft.trim()} aria-label="Send message" className="rounded-xl border border-[#282A2B] bg-[#D67C65] px-2.5 text-white transition hover:bg-[#bd6754] disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
      </form>
    </section>
  );
}
