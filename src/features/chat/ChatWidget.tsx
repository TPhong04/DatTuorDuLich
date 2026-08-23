import { useEffect, useRef, useState } from 'react'
import { useChat, ChatMessageItem } from './useChat'
import './ChatWidget.css'

function StatusBadge({
  status,
  assignedStaffName,
  slaBreached,
  slaLabel,
}: {
  status: 'BOT' | 'ESCALATED' | 'CLOSED'
  assignedStaffName: string | null
  slaBreached: boolean
  slaLabel: string | null
}) {
  if (status === 'CLOSED') {
    return <span className="chat-status chat-status--closed">Đã đóng ✓</span>
  }
  if (assignedStaffName) {
    return (
      <span className="chat-status chat-status--staff" title={slaLabel || ''}>
        👤 Nhân viên {assignedStaffName} đang hỗ trợ
        {slaBreached && <span className="text-rose-200 ml-1 text-xs">· SLA quá hạn</span>}
      </span>
    )
  }
  if (status === 'ESCALATED') {
    return (
      <span className="chat-status chat-status--escalated" title={slaLabel || ''}>
        🔔 Đang chuyển nhân viên
        {slaLabel && <span className="opacity-80 ml-1 text-xs">· {slaLabel}</span>}
      </span>
    )
  }
  return <span className="chat-status chat-status--bot">Trợ lý ảo</span>
}

function Bubble({ msg }: { msg: ChatMessageItem }) {
  if (msg.role === 'system') {
    return (
      <div className="chat-system-line text-xs text-gray-500 italic text-center py-1">{msg.text}</div>
    )
  }
  const label =
    msg.role === 'user' ? 'Bạn' : msg.role === 'staff' ? 'Nhân viên' : msg.role === 'bot' ? 'Hỗ trợ' : ''
  return (
    <div className={`chat-bubble chat-bubble--${msg.role}`}>
      {label && <div className="text-[10px] uppercase tracking-wide opacity-70 mb-1">{label}</div>}
      <div className="whitespace-pre-wrap">{msg.text}</div>
    </div>
  )
}

function GuestInfoForm({
  initial,
  onContinue,
}: {
  initial: { name: string | null; email: string | null; phone: string | null }
  onContinue: (info: { name: string; email: string; phone: string }) => void
}) {
  const [name, setName] = useState(initial.name ?? '')
  const [email, setEmail] = useState(initial.email ?? '')
  const [phone, setPhone] = useState(initial.phone ?? '')
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || (!email.trim() && !phone.trim())) return
    setSubmitting(true)
    onContinue({
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    })
  }

  return (
    <div className="chat-guest-form flex flex-col gap-3 p-4 text-sm">
      <div className="text-gray-700 font-medium">Để nhân viên hỗ trợ nhanh hơn, vui lòng để lại thông tin:</div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Họ tên <span className="text-rose-500">*</span></label>
        <input
          className="w-full border rounded px-3 py-2 outline-none focus:border-teal-600"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nguyễn Văn A"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Email</label>
        <input
          type="email"
          className="w-full border rounded px-3 py-2 outline-none focus:border-teal-600"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Số điện thoại</label>
        <input
          className="w-full border rounded px-3 py-2 outline-none focus:border-teal-600"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="090..."
        />
      </div>
      <div className="text-xs text-gray-500 italic">Cần email hoặc SĐT để liên hệ lại khi cần.</div>
      <button
        type="button"
        className="bg-teal-700 hover:bg-teal-800 text-white rounded py-2 font-medium disabled:opacity-50"
        disabled={submitting || !name.trim() || (!email.trim() && !phone.trim())}
        onClick={onSubmit}
      >
        {submitting ? 'Đang xử lý...' : 'Tiếp tục chat với nhân viên'}
      </button>
    </div>
  )
}

function RatingWidget({
  disabled,
  defaultRating,
  onSubmit,
  defaultComment,
}: {
  disabled?: boolean
  defaultRating?: number | null
  defaultComment?: string | null
  onSubmit: (stars: number, comment?: string) => Promise<{ ok: boolean; voucher?: string | undefined }>
}) {
  const [stars, setStars] = useState<number>(defaultRating ?? 0)
  const [hover, setHover] = useState<number>(0)
  const [comment, setComment] = useState<string>(defaultComment ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [voucher, setVoucher] = useState<string | undefined>(undefined)
  const [done, setDone] = useState<boolean>(!!defaultRating && defaultRating > 0)
  const [error, setError] = useState<string | null>(null)

  const onBtnSubmit = async () => {
    if (done || disabled || stars < 1) return
    setSubmitting(true)
    setError(null)
    try {
      const resp = await onSubmit(stars, comment)
      if (resp.ok) {
        setVoucher(resp.voucher)
        setDone(true)
      }
    } catch (e: any) {
      setError(e?.message || 'Không thể gửi đánh giá, vui lòng thử lại sau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="chat-rating-box border-t border-gray-200 bg-amber-50 p-4 text-sm">
      <div className="font-semibold text-amber-900 mb-1">
        {done ? 'Cảm ơn bạn đã đánh giá! 🎉' : 'Bạn đánh giá dịch vụ hỗ trợ này?'}
      </div>
      {!done ? (
        <>
          <div className="flex items-center gap-1 my-2 select-none">
            {[1, 2, 3, 4, 5].map((i) => {
              const filled = i <= (hover || stars)
              return (
                <button
                  type="button"
                  key={i}
                  onClick={() => setStars(i)}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(0)}
                  disabled={submitting || disabled}
                  className={`text-3xl transition ${filled ? 'text-amber-400' : 'text-gray-300'} disabled:opacity-50`}
                  title={`${i} sao`}
                >
                  ★
                </button>
              )
            })}
            <span className="ml-3 text-xs text-gray-500">
              {stars === 1 && 'Rất tệ'}
              {stars === 2 && 'Tệ'}
              {stars === 3 && 'Bình thường'}
              {stars === 4 && 'Tốt'}
              {stars === 5 && 'Xuất sắc'}
            </span>
          </div>
          <textarea
            className="w-full border rounded px-3 py-2 outline-none text-sm mb-2"
            rows={2}
            placeholder="Nội dung ý kiến (không bắt buộc)..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            disabled={submitting || disabled}
          />
          <button
            type="button"
            className="bg-amber-500 hover:bg-amber-600 text-white rounded px-4 py-2 font-medium disabled:opacity-50"
            disabled={stars < 1 || submitting || disabled}
            onClick={onBtnSubmit}
          >
            {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
          </button>
          {error && <div className="mt-2 text-xs text-rose-600">{error}</div>}
        </>
      ) : (
        <>
          <div className="flex items-center gap-1 my-1">
            {[1, 2, 3, 4, 5].map((i) => (
              <span key={i} className={`text-2xl ${i <= (stars || 0) ? 'text-amber-400' : 'text-gray-300'}`}>
                ★
              </span>
            ))}
            <span className="ml-2 text-xs text-gray-600">{stars} / 5 sao</span>
          </div>
          {comment && <div className="italic text-xs text-gray-700">“{comment}”</div>}
          {voucher && (
            <div className="mt-3 p-3 rounded-md bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200">
              <div className="font-semibold text-emerald-800 text-sm mb-1">
                🎁 Cảm ơn đánh giá 5 sao của bạn! Quà từ ViệtNamExplorer
              </div>
              <div className="text-xs text-gray-700 mb-1">
                Mã giảm giá <b>5%</b> khi đặt tour kế tiếp:
              </div>
              <div className="font-mono text-lg font-bold text-teal-800 tracking-widest select-all bg-white px-3 py-1 inline-block rounded border">
                {voucher}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export function ChatWidget() {
  const chat = useChat()
  const { messages, status, isSending, sendMessage, submitRating, assignedStaffName, ratingStars, ratingComment, slaBreached, slaLabel, customerInfo, escalationReason, sessionId } = chat
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const [guestDone, setGuestDone] = useState<boolean>(!!customerInfo.name)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (customerInfo.name) setGuestDone(true)
  }, [customerInfo.name])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isSending) return
    sendMessage(input)
    setInput('')
  }

  const needInfo = status === 'ESCALATED' && !guestDone && !customerInfo.name

  const isClosed = status === 'CLOSED'

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
          <StatusBadge
            status={status}
            assignedStaffName={assignedStaffName}
            slaBreached={!!slaBreached}
            slaLabel={slaLabel}
          />
        </div>
        <button className="chat-close" onClick={() => setOpen(false)} aria-label="Đóng chat">
          ✕
        </button>
      </div>

      {escalationReason && status !== 'BOT' && status !== 'CLOSED' && !assignedStaffName && (
        <div className="chat-escalation-note">
          🔔 {escalationReason}
        </div>
      )}

      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="chat-empty">Gõ tin nhắn để bắt đầu, ví dụ: "Cho tôi xem tour Đà Lạt"</div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} msg={m} />
        ))}
        {isSending && <div className="chat-bubble chat-bubble--system">Đang trả lời...</div>}
        {needInfo && (
          <div className="p-2">
            <GuestInfoForm
              initial={{ name: customerInfo.name, email: customerInfo.email, phone: customerInfo.phone }}
              onContinue={async (info) => {
                setGuestDone(true)
                if (customerInfo.name !== info.name || customerInfo.email !== info.email || customerInfo.phone !== info.phone) {
                  // Gửi một tin nhắn ẩn trigger lưu thông tin (chỉ gọi sendMessage đầu tiên thường lưu info rồi)
                  try {
                    await sendMessage('Cảm ơn bạn đã cung cấp thông tin. Nhân viên sẽ sớm phản hồi.', info)
                  } catch {
                    // ignore
                  }
                }
              }}
            />
          </div>
        )}
      </div>

      {isClosed && (
        <RatingWidget
          disabled={!sessionId}
          defaultRating={ratingStars}
          defaultComment={ratingComment}
          onSubmit={(stars, comment) => submitRating(stars, comment)}
        />
      )}

      {!isClosed && (
        <form className="chat-composer" onSubmit={handleSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={guestDone ? 'Nhập tin nhắn...' : 'Nhập tin nhắn (nếu cần hỗ trợ ngay)'}
            disabled={isSending}
          />
          <button type="submit" disabled={isSending || !input.trim()}>
            Gửi
          </button>
        </form>
      )}
    </div>
  )
}
