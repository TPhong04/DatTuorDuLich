import { useCallback, useRef, useState } from 'react'
import { apiFetch } from '@/lib/api'

export type ChatRole = 'user' | 'bot' | 'system'

export interface ChatMessageItem {
  id: string
  role: ChatRole
  text: string
}

export type ChatStatus = 'BOT' | 'ESCALATED' | 'CLOSED'

interface ChatMessageResponse {
  sessionId: string
  status?: ChatStatus
  reply?: string
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [status, setStatus] = useState<ChatStatus>('BOT')
  const [isSending, setIsSending] = useState(false)
  const sessionIdRef = useRef<string | undefined>(undefined)

  const pushMessage = useCallback((role: ChatRole, text: string) => {
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role, text }])
  }, [])

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isSending) return

      pushMessage('user', trimmed)
      setIsSending(true)

      try {
        const data = await apiFetch<ChatMessageResponse>('/chat/message', {
          method: 'POST',
          body: JSON.stringify({
            sessionId: sessionIdRef.current,
            message: trimmed,
          }),
        })

        sessionIdRef.current = data.sessionId
        setStatus(data.status ?? 'BOT')
        pushMessage('bot', data.reply ?? '(không có phản hồi)')
      } catch (err: any) {
        const statusCode = err?.status ?? ''
        const msg = err?.message ?? (err as Error).message
        const friendly = statusCode
          ? `Lỗi ${statusCode}: ${msg}`
          : `Không kết nối được tới hệ thống chat: ${msg}`
        pushMessage('system', friendly)
      } finally {
        setIsSending(false)
      }
    },
    [isSending, pushMessage],
  )

  return { messages, status, isSending, sendMessage }
}
