'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TeamConversation, TeamMessage } from '@/lib/team-types';
import { isAbort, teamRequest } from './team-api';

export function mergeMessages(existing: TeamMessage[], incoming: TeamMessage[]) {
  const messages = new Map(existing.map((message) => [message.id, message]));
  incoming.forEach((message) => messages.set(message.id, message));
  return [...messages.values()].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

export function useConversation(path: string | null) {
  const [thread, setThread] = useState<TeamConversation | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<unknown>(null);
  const [olderLoading, setOlderLoading] = useState(false);
  const generation = useRef(0);
  const olderController = useRef<AbortController | null>(null);
  const olderInFlight = useRef(false);
  useEffect(() => {
    generation.current += 1;
    olderController.current?.abort();
    olderInFlight.current = false;
    setOlderLoading(false);
    setThread(null);
    setError(null);
    setLoading(Boolean(path));
    if (!path) return;
    let stopped = false;
    let inFlight = false;
    let controller: AbortController | null = null;
    async function load() {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      controller = new AbortController();
      try {
        const result = await teamRequest<TeamConversation>(path!, { signal: controller.signal });
        if (!stopped) {
          setThread((previous) => {
            const knownIds = new Set(previous?.messages.map((message) => message.id));
            const missedWindow = Boolean(
              previous &&
              result.hasMore &&
              !result.messages.some((message) => knownIds.has(message.id)),
            );
            return {
              ...result,
              messages: mergeMessages(previous?.messages ?? [], result.messages),
              hasMore: missedWindow ? true : previous ? previous.hasMore : result.hasMore,
              nextBefore: missedWindow
                ? result.nextBefore
                : previous
                  ? previous.nextBefore
                  : result.nextBefore,
            };
          });
          setError(null);
        }
      } catch (failure) {
        if (!stopped && !isAbort(failure)) setError(failure);
      } finally {
        inFlight = false;
        if (!stopped) setLoading(false);
      }
    }
    void load();
    const timer = window.setInterval(() => {
      void load();
    }, 8000);
    const visibility = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      generation.current += 1;
      olderController.current?.abort();
      clearInterval(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [path]);

  const appendMessage = useCallback((message: TeamMessage, updatedAt: string) => {
    setThread((previous) =>
      previous
        ? { ...previous, updatedAt, messages: mergeMessages(previous.messages, [message]) }
        : previous,
    );
  }, []);

  async function loadOlder() {
    if (!path || !thread?.nextBefore || olderInFlight.current) return;
    const currentGeneration = generation.current;
    const controller = new AbortController();
    olderController.current = controller;
    olderInFlight.current = true;
    setOlderLoading(true);
    try {
      const older = await teamRequest<TeamConversation>(
        `${path}?before=${encodeURIComponent(thread.nextBefore)}`,
        { signal: controller.signal },
      );
      if (controller.signal.aborted || generation.current !== currentGeneration) return;
      setThread((previous) =>
        previous
          ? {
              ...previous,
              messages: mergeMessages(older.messages, previous.messages),
              hasMore: older.hasMore,
              nextBefore: older.nextBefore,
            }
          : previous,
      );
      setError(null);
    } catch (failure) {
      if (!isAbort(failure) && generation.current === currentGeneration) setError(failure);
    } finally {
      if (generation.current === currentGeneration) {
        olderInFlight.current = false;
        setOlderLoading(false);
      }
    }
  }

  return { thread, loading, error, olderLoading, loadOlder, appendMessage };
}
