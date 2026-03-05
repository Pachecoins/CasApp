import { useState, useEffect, useRef, useCallback } from 'react'
import { Send, X, MessageSquare } from 'lucide-react'
import { type Socket } from 'socket.io-client'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

export interface ChatMessage {
  id: string
  requestId: string
  senderId: string
  senderName: string
  message: string
  timestamp: string
}

interface ChatWidgetProps {
  socket: Socket | null
  requestId: string
  currentUserId: string
  currentUserName: string
  /** Compact mode: renders as a floating button + slide-up panel */
  floating?: boolean
  className?: string
}

export function ChatWidget({
  socket,
  requestId,
  currentUserId,
  currentUserName,
  floating = false,
  className,
}: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isOpen, setIsOpen] = useState(!floating)
  const [unread, setUnread] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load history on mount
  useEffect(() => {
    api.get(`/chat/${requestId}`)
      .then(({ data }) => {
        if (Array.isArray(data.data)) {
          setMessages(data.data.map((m: { id: string; serviceRequestId: string; senderId: string; senderName: string; message: string; createdAt: string }) => ({
            ...m,
            requestId: m.serviceRequestId,
            timestamp: m.createdAt,
          })))
        }
      })
      .catch(() => {}) // silently fail — socket will still work
  }, [requestId])

  useEffect(() => {
    if (!socket) return

    const handler = (msg: ChatMessage) => {
      if (msg.requestId !== requestId) return
      setMessages((prev) => [...prev, msg])
      if (!isOpen && msg.senderId !== currentUserId) {
        setUnread((n) => n + 1)
      }
    }

    socket.on('chat:message', handler)
    return () => { socket.off('chat:message', handler) }
  }, [socket, requestId, currentUserId, isOpen])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isOpen])

  const handleOpen = () => {
    setIsOpen(true)
    setUnread(0)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || !socket) return

    const msg: Omit<ChatMessage, 'id' | 'timestamp'> = {
      requestId,
      senderId: currentUserId,
      senderName: currentUserName,
      message: text,
    }
    socket.emit('chat:message', msg)
    setInput('')
  }, [input, socket, requestId, currentUserId, currentUserName])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const chatPanel = (
    <div className={cn('flex flex-col bg-white', floating ? 'rounded-t-3xl' : 'h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          <span className="font-semibold text-gray-800">Chat</span>
        </div>
        {floating && (
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0" style={{ maxHeight: floating ? '280px' : undefined }}>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400">Aún no hay mensajes</p>
            <p className="text-xs text-gray-300 mt-1">Podés escribirle al profesional aquí</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            return (
              <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-3 py-2', isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')}>
                  {!isMe && (
                    <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.senderName}</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  <p className={cn('text-xs mt-0.5', isMe ? 'text-primary-100 text-right' : 'text-gray-400')}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí un mensaje..."
          className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-transparent focus:border-primary"
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  )

  if (!floating) return chatPanel

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className="relative w-14 h-14 rounded-full bg-primary shadow-lg flex items-center justify-center"
        >
          <MessageSquare size={22} className="text-white" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary rounded-full text-white text-xs flex items-center justify-center font-bold">
              {unread}
            </span>
          )}
        </button>
      )}

      {/* Slide-up panel */}
      {isOpen && (
        <div className="fixed bottom-0 left-0 right-0 z-50 shadow-2xl border-t border-gray-100">
          {chatPanel}
        </div>
      )}
    </>
  )
}
