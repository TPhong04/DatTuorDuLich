import { useEffect, useRef, useState } from 'react'
import { useChat } from './useChat'
import './ChatWidget.css'

export function ChatWidget() {
  const { messages, status, isSending, sendMessage } = useChat()
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  if (!open) {
    return (
      <button className="chat-fab" onClick={() => setOpen(true)} aria-label="Mở chat hỗ trợ">
        💬
      </button>
    )
  }

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <div>
          <h2>Hỗ trợ khách hàng</h2>
          <span className={`chat-status chat-status--${status.toLowerCase()}`}>
            {status === 'BOT' && 'Trợ lý ảo'}
            {status === 'ESCALATED' && 'Đang chuyển nhân viên'}
            {status === 'CLOSED' && 'Đã đóng'}
          </span>
        </div>
        <button className="chat-close" onClick={() => setOpen(false)} aria-label="Đóng chat">
          ✕
        </button>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">Gõ tin nhắn để bắt đầu, ví dụ: "Cho tôi xem tour Đà Lạt"</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-bubble chat-bubble--${m.role}`}>
            {m.text}
          </div>
        ))}
        {isSending && <div className="chat-bubble chat-bubble--system">Đang trả lời...</div>}
      </div>

      <form className="chat-composer" onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Nhập tin nhắn..."
          disabled={isSending}
        />
        <button type="submit" disabled={isSending || !input.trim()}>
          Gửi
        </button>
      </form>
    </div>
  )
}
