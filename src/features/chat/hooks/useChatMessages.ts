'use client';

import { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store/store';
import { setMessages, setChatStatus } from '@/features/chat/store/chatSlice';
import { subscribeMessages } from '@/features/chat/services/messagesService';

const MESSAGE_LIMIT = 100;

export function useChatMessages() {
  const dispatch = useAppDispatch();
  const userId = useAppSelector((s) => s.auth.user?.id);
  const status = useAppSelector((s) => s.chat.status);

  useEffect(() => {
    if (!userId) return;
    dispatch(setChatStatus('loading'));

    const unsub = subscribeMessages(userId, MESSAGE_LIMIT, (msgs) => {
      dispatch(setMessages(msgs));
    });

    return () => unsub();
  }, [userId, dispatch]);

  return { status };
}
