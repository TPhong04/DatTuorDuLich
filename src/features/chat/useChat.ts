import { useCallback, useRef, useState } from 'react'

export type ChatRole = 'user' | 'bot' | 'system'

export interface ChatMessageItem {
  id: string
  role: ChatRole
  text: string
}

export type ChatStatus = 'BOT' | 'ESCALATED' | 'CLOSED'

// Đổi URL này nếu backend chạy port khác, hoặc trỏ tới biến môi trường VITE_API_URL của bạn
const API_URL = import.meta.env.VITE_CHAT_API_URL ?? 'http://localhost:4000/api/chat/message'

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
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: sessionIdRef.current, message: trimmed }),
        })

        if (!res.ok) {
          const errText = await res.text()
          pushMessage('system', `Lỗi ${res.status}: ${errText}`)
          return
        }

        const data = await res.json()
        sessionIdRef.current = data.sessionId
        setStatus(data.status ?? 'BOT')
        pushMessage('bot', data.reply ?? '(không có phản hồi)')
      } catch (err) {
        pushMessage('system', `Không kết nối được tới backend: ${(err as Error).message}`)
      } finally {
        setIsSending(false)
      }
    },
    [isSending, pushMessage],
  )

  return { messages, status, isSending, sendMessage }
}