import { useState, useEffect, useRef, useCallback } from 'react'
import { Send } from 'lucide-react'
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

interface ChatPanelProps {
  socket: Socket | null
  requestId: string
  currentUserId: string
  currentUserName: string
  className?: string
}

export function ChatPanel({ socket, requestId, currentUserId, currentUserName, className }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  // Load history
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
      .catch(() => {})
  }, [requestId])

  useEffect(() => {
    if (!socket) return
    const handler = (msg: ChatMessage) => {
      if (msg.requestId === requestId) setMessages((prev) => [...prev, msg])
    }
    socket.on('chat:message', handler)
    return () => { socket.off('chat:message', handler) }
  }, [socket, requestId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || !socket) return
    socket.emit('chat:message', {
      requestId,
      senderId: currentUserId,
      senderName: currentUserName,
      message: text,
    })
    setInput('')
  }, [input, socket, requestId, currentUserId, currentUserName])

  const formatTime = (ts: string) =>
    new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-4">Enviá un mensaje al cliente</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUserId
            return (
              <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                <div className={cn('max-w-[80%] rounded-2xl px-3 py-2 text-sm',
                  isMe ? 'bg-primary text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')}>
                  {!isMe && <p className="text-xs font-semibold mb-0.5 opacity-70">{msg.senderName}</p>}
                  <p className="leading-relaxed">{msg.message}</p>
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
      <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send() }}
          placeholder="Mensaje al cliente..."
          className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary border border-transparent focus:border-primary"
        />
        <button
          onClick={send}
          disabled={!input.trim()}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center disabled:opacity-40 flex-shrink-0"
        >
          <Send size={15} className="text-white" />
        </button>
      </div>
    </div>
  )
}
