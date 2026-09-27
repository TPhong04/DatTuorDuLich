import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { apiFetch } from '@/lib/api'
import {
  customerChatSendMessage,
  customerGetChatSessionInfo,
  customerSubmitChatRating,
  customerUpdateGuestInfo,
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

function useChatSocket(
  sessionId: string | null | undefined,
  customerInfo: { name: string | null; email: string | null; phone: string | null },
  onNewMessage: (m: ChatMessageItem) => void,
  onSessionPatch: (patch: Partial<ChatWidgetState>) => void,
) {
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
      const guestToken = safeLsGet(LS_KEY_GUEST_TOKEN) || undefined
      socket.emit('chat:join-room', {
        sessionId,
        guestToken,
        guestEmail: customerInfo.email || undefined,
        guestPhone: customerInfo.phone || undefined,
      })
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

/**
 * ✅ C4: LocalStorage keys để persist session của widget
 *     khách không bị mất chat khi F5 / đóng-mở lại tab
 */
const LS_KEY_SESSION_ID = 'chat:sessionId'
const LS_KEY_GUEST_TOKEN = 'chat:guestToken'
const LS_KEY_GUEST_INFO = 'chat:guestInfo'

function safeLsGet(key: string): string | null {
  try { return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null } catch { return null }
}
function safeLsSet(key: string, val: string | null) {
  try {
    if (typeof window === 'undefined') return
    if (val == null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, val)
  } catch { /* ignore - e.g. Safari private mode */ }
}

export function useChat(initialSessionId?: string | null, initialGuestInfo?: { name?: string | null; email?: string | null; phone?: string | null }) {
  const [state, setState] = useState<ChatWidgetState>(() => {
    // ✅ Khôi phục từ localStorage trước (người dùng F5)
    const storedSid = initialSessionId ?? safeLsGet(LS_KEY_SESSION_ID) ?? null
    let persistedInfo: { name: string | null; email: string | null; phone: string | null } | null = null
    try {
      const raw = safeLsGet(LS_KEY_GUEST_INFO)
      if (raw) persistedInfo = JSON.parse(raw)
    } catch { /* ignore */ }

    return {
      messages: [],
      status: 'BOT',
      isSending: false,
      assignedStaffName: null,
      escalationReason: null,
      ratingStars: null,
      ratingComment: null,
      ratedAt: null,
      closedAt: null,
      sessionId: storedSid,
      slaLabel: null,
      slaBreached: false,
      customerInfo: {
        name: initialGuestInfo?.name ?? persistedInfo?.name ?? null,
        email: initialGuestInfo?.email ?? persistedInfo?.email ?? null,
        phone: initialGuestInfo?.phone ?? persistedInfo?.phone ?? null,
      },
    }
  })

  // ✅ Persist: sessionId thay đổi → ghi xuống localStorage
  useEffect(() => {
    safeLsSet(LS_KEY_SESSION_ID, state.sessionId)
    // Nếu chat đã đóng & khách đã đánh giá xong → cho phép tạo session mới vào lần sau (clear sau 24h tự BE, hoặc ở đây giữ lại để xem lịch sử)
  }, [state.sessionId])

  // ✅ Persist: customerInfo thay đổi (khách điền tên/SĐT ở GuestInfoForm)
  useEffect(() => {
    try {
      const payload = JSON.stringify(state.customerInfo)
      safeLsSet(LS_KEY_GUEST_INFO, payload)
    } catch { /* ignore */ }
  }, [state.customerInfo.name, state.customerInfo.email, state.customerInfo.phone])

  const loadedOnceRef = useRef(false)
  // ✅ L4: Unique ID counter cho pushMessage (tránh trùng Date.now khi gửi 2 tin same ms)
  const msgIdCounterRef = useRef<number>(0)
  const rand4Hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1)

  const pushMessage = useCallback((role: ChatRole, text: string, createdAt?: string | null, id?: string) => {
    setState((prev) => {
      if (!text || !text.trim()) return prev
      // Tạo unique ID theo pattern: local-{ts}-{counter}-{rand} (không trùng dù gửi 100 tin/ms)
      const nextId = (() => {
        if (id) return id
        msgIdCounterRef.current = (msgIdCounterRef.current + 1) % 1_000_000
        const ts = createdAt ? new Date(createdAt).getTime() : Date.now()
        return `local-${ts}-${msgIdCounterRef.current.toString(36)}-${rand4Hex()}`
      })()
      return {
        ...prev,
        messages: [
          ...prev.messages,
          {
            id: nextId,
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
    state.customerInfo,
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

        // ✅ C4: Lưu guestToken BE trả về (dùng cho ownership check sau này)
        if ((data as any).guestToken) {
          safeLsSet(LS_KEY_GUEST_TOKEN, String((data as any).guestToken))
        }

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

  // ✅ M2: Cập nhật thông tin khách vãng lai BẰNG ENDPOINT RIÊNG (KHÔNG lưu thành tin nhắn USER giả)
  const submitGuestInfo = useCallback(
    async (info: { name?: string; email?: string; phone?: string }) => {
      if (!state.sessionId) return { updated: false }
      // Chỉ gửi những field thật sự đã có thay đổi (có giá trị và khác trạng thái hiện tại)
      const payload: { sessionId: string; guestName?: string; guestEmail?: string; guestPhone?: string } = {
        sessionId: state.sessionId,
      }
      if (info.name && info.name.trim() !== state.customerInfo.name) payload.guestName = info.name.trim()
      if (info.email && info.email.trim() !== state.customerInfo.email) payload.guestEmail = info.email.trim()
      if (info.phone && info.phone.trim() !== state.customerInfo.phone) payload.guestPhone = info.phone.trim()
      // Không có thay đổi gì → skip gọi API
      if (!payload.guestName && !payload.guestEmail && !payload.guestPhone) {
        return { updated: false }
      }
      const resp = await customerUpdateGuestInfo(payload)
      if (resp?.updated) {
        const s = resp.session as ChatSession
        setState((prev) => ({
          ...prev,
          customerInfo: {
            name: s.guestName ?? prev.customerInfo.name,
            email: s.guestEmail ?? prev.customerInfo.email,
            phone: s.guestPhone ?? prev.customerInfo.phone,
          },
        }))
        // Persist vào localStorage (C4) - stringify trước khi lưu (giống pattern useEffect ở trên 176-181)
        try {
          safeLsSet(LS_KEY_GUEST_INFO, JSON.stringify({
            name: s.guestName ?? state.customerInfo.name,
            email: s.guestEmail ?? state.customerInfo.email,
            phone: s.guestPhone ?? state.customerInfo.phone,
          }))
        } catch { /* ignore */ }
      }
      return resp
    },
    [state.sessionId, state.customerInfo],
  )

  const info = useMemo(() => state, [state])

  return { ...info, sendMessage, submitRating, submitGuestInfo, pushMessage }
}
