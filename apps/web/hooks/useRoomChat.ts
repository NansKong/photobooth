'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatMessage, SocketEvents } from '@photobooth/shared';
import { Socket } from 'socket.io-client';

export function useRoomChat(socket: Socket | null, roomId: string, canChat: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    setMessages([]);
    if (!socket) return;

    const onHistory = (history: ChatMessage[]) => {
      if (!Array.isArray(history)) return;
      setMessages(history.filter((message) => message.roomId === roomId).slice(-50));
    };
    const onMessage = (message: ChatMessage) => {
      if (!message || message.roomId !== roomId) return;
      setMessages((current) => (
        current.some((item) => item.id === message.id) ? current : [...current, message].slice(-50)
      ));
    };

    socket.on(SocketEvents.CHAT_HISTORY, onHistory);
    socket.on(SocketEvents.CHAT_MESSAGE, onMessage);
    return () => {
      socket.off(SocketEvents.CHAT_HISTORY, onHistory);
      socket.off(SocketEvents.CHAT_MESSAGE, onMessage);
    };
  }, [socket, roomId]);

  const sendMessage = useCallback((text: string): boolean => {
    const trimmed = text.trim();
    if (!socket?.connected || !canChat || !trimmed) return false;
    socket.emit(SocketEvents.CHAT_SEND, { roomId, text: trimmed.slice(0, 500) });
    return true;
  }, [socket, roomId, canChat]);

  return { messages, sendMessage };
}
