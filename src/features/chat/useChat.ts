import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { apiFetch } from '@/lib/api'
import {
  customerChatSendMessage,
  customerGetChatSessionInfo,
  customerSubmitChatRating,
  ChatStatus as ApiStatus,
  ChatRole as ApiRole,
  ChatMessage,
  ChatSession,
} from './chat'

export type ChatRole = 'user' | 'bot' | 'staff' | 'system'

export interface ChatMessageItem {
  id: string
  role: ChatRole
  text: string
  createdAt?: string | null
}

export type ChatStatus = ApiStatus

export interface ChatWidgetState {
  messages: ChatMessageItem[]
  status: ChatStatus
  isSending: boolean
  assignedStaffName: string | null
  escalationReason: string | null
  ratingStars: number | null
  ratingComment: string | null
  ratedAt: string | null
  closedAt: string | null
  sessionId: string | null
  slaLabel: string | null
  slaBreached: boolean
  customerInfo: {
    name: string | null
    email: string | null
    phone: string | null
  }
}

const mapApiRole = (r: ApiRole | string): ChatRole => {
  switch (r) {
    case 'USER':
      return 'user'
    case 'STAFF':
      return 'staff'
    case 'SYSTEM':
      return 'system'
    default:
      return 'bot'
  }
}

const fromApiMessage = (m: ChatMessage): ChatMessageItem => ({
  id: m.id,
  role: mapApiRole(m.role),
  text: m.content ?? '',
  createdAt: m.createdAt,
})

function useChatSocket(sessionId: string | null | undefined, onNewMessage: (m: ChatMessageItem) => void, onSessionPatch: (patch: Partial<ChatWidgetState>) => void) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const ns = '/chat'
    const socket = io(ns, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('chat:join-room', { sessionId })
    })

    socket.on('chat:new-message', (payload: any) => {
      if (!payload?.message) return
      const msg: ChatMessage = payload.message
      if (msg.sessionId === sessionId) {
        if (msg.role === 'USER') return
        onNewMessage(fromApiMessage(msg))
      }
    })

    socket.on('chat:session-updated', (payload: any) => {
      if (!payload?.sessionId || payload.sessionId !== sessionId) return
      const patch: any = payload.patch || payload || {}
      const state: Partial<ChatWidgetState> = {}
      if (patch.status) state.status = patch.status
      if (patch.assignedStaffName !== undefined) state.assignedStaffName = patch.assignedStaffName ?? null
      if (patch.escalationReason !== undefined) state.escalationReason = patch.escalationReason ?? null
      if (patch.closedAt !== undefined) state.closedAt = patch.closedAt ?? null
      if (patch.ratingStars !== undefined) state.ratingStars = patch.ratingStars ?? null
      if (patch.ratedAt !== undefined) state.ratedAt = patch.ratedAt ?? null
      if (patch.slaLabel !== undefined) state.slaLabel = patch.slaLabel ?? null
      if (patch.slaBreached !== undefined) state.slaBreached = !!patch.slaBreached
      onSessionPatch(state)
    })

    return () => {
      socket.off('chat:new-message')
      socket.off('chat:session-updated')
      socket.disconnect()
      socketRef.current = null
    }
  }, [sessionId, onNewMessage, onSessionPatch])

  return socketRef
}

export function useChat(initialSessionId?: string | null, initialGuestInfo?: { name?: string | null; email?: string | null; phone?: string | null }) {
  const [state, setState] = useState<ChatWidgetState>(() => ({
    messages: [],
    status: 'BOT',
    isSending: false,
    assignedStaffName: null,
    escalationReason: null,
    ratingStars: null,
    ratingComment: null,
    ratedAt: null,
    closedAt: null,
    sessionId: initialSessionId ?? null,
    slaLabel: null,
    slaBreached: false,
    customerInfo: {
      name: initialGuestInfo?.name ?? null,
      email: initialGuestInfo?.email ?? null,
      phone: initialGuestInfo?.phone ?? null,
    },
  }))

  const loadedOnceRef = useRef(false)

  const pushMessage = useCallback((role: ChatRole, text: string, createdAt?: string | null, id?: string) => {
    setState((prev) => {
      if (!text || !text.trim()) return prev
      return {
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: id ?? (createdAt ? `${Date.now()}-${role}` : crypto.randomUUID()),
            role,
            text,
            createdAt,
          },
        ],
      }
    })
  }, [])

  useChatSocket(
    state.sessionId,
    useCallback((m: ChatMessageItem) => {
      setState((prev) => {
        if (prev.messages.some((x) => x.id === m.id)) return prev
        return { ...prev, messages: [...prev.messages, m] }
      })
    }, []),
    useCallback((patch) => {
      setState((prev) => ({ ...prev, ...patch }))
    }, [])
  )

  useEffect(() => {
    if (!state.sessionId || loadedOnceRef.current) return
    loadedOnceRef.current = true
    customerGetChatSessionInfo(state.sessionId)
      .then((resp) => {
        const s: ChatSession = resp.session
        const msgs: ChatMessageItem[] = (resp.messages ?? []).map(fromApiMessage)
        setState((prev) => ({
          ...prev,
          messages: msgs,
          status: s.status ?? 'BOT',
          assignedStaffName: s.assignedStaffName ?? null,
          escalationReason: s.escalationReason ?? null,
          ratingStars: s.ratingStars ?? null,
          ratingComment: s.ratingComment ?? null,
          ratedAt: s.ratedAt ?? null,
          closedAt: s.closedAt ?? null,
          slaLabel: s.slaLabel ?? null,
          slaBreached: !!s.slaBreached,
          customerInfo: {
            name: s.guestName ?? prev.customerInfo.name,
            email: s.guestEmail ?? prev.customerInfo.email,
            phone: s.guestPhone ?? prev.customerInfo.phone,
          },
        }))
      })
      .catch(() => {
        loadedOnceRef.current = false
      })
  }, [state.sessionId])

  const sendMessage = useCallback(
    async (text: string, opts?: { name?: string | null; email?: string | null; phone?: string | null }) => {
      const trimmed = text.trim()
      if (!trimmed || state.isSending) return

      pushMessage('user', trimmed)

      setState((prev) => {
        const info = {
          name: opts?.name ?? prev.customerInfo.name,
          email: opts?.email ?? prev.customerInfo.email,
          phone: opts?.phone ?? prev.customerInfo.phone,
        }
        return { ...prev, isSending: true, customerInfo: info }
      })

      try {
        const data = await customerChatSendMessage({
          sessionId: state.sessionId ?? undefined,
          message: trimmed,
          guestName: opts?.name ?? state.customerInfo.name ?? undefined,
          guestEmail: opts?.email ?? state.customerInfo.email ?? undefined,
          guestPhone: opts?.phone ?? state.customerInfo.phone ?? undefined,
        })

        setState((prev) => ({
          ...prev,
          sessionId: data.sessionId,
          status: data.status ?? 'BOT',
          assignedStaffName: (data as any).assignedStaffName ?? prev.assignedStaffName,
          isSending: false,
        }))

        if (data.reply?.trim()) {
          pushMessage('bot', data.reply.trim())
        }
      } catch (err: any) {
        const statusCode = err?.status ?? ''
        const msg = err?.message ?? (err as Error).message
        const friendly = statusCode
          ? `Lỗi ${statusCode}: ${msg}`
          : `Không kết nối được tới hệ thống chat: ${msg}`
        pushMessage('system', friendly)
        setState((prev) => ({ ...prev, isSending: false }))
      }
    },
    [state.isSending, state.sessionId, state.customerInfo, pushMessage],
  )

  const submitRating = useCallback(
    async (ratingStars: number, ratingComment?: string, guestEmail?: string) => {
      if (!state.sessionId || ratingStars < 1 || ratingStars > 5) return { ok: false }
      const resp = await customerSubmitChatRating({
        sessionId: state.sessionId,
        ratingStars,
        ratingComment: ratingComment?.trim(),
        guestEmail: guestEmail?.trim() || state.customerInfo.email || undefined,
      })
      setState((prev) => ({
        ...prev,
        ratingStars: resp.ratingStars,
        ratingComment: ratingComment?.trim() ?? prev.ratingComment,
        ratedAt: new Date().toISOString(),
      }))
      return { ok: true, ratingStars: resp.ratingStars, voucher: ratingStars === 5 ? 'VNEX-CS5P17' : undefined }
    },
    [state.sessionId, state.customerInfo.email],
  )

  const info = useMemo(() => state, [state])

  return { ...info, sendMessage, submitRating, pushMessage }
}
