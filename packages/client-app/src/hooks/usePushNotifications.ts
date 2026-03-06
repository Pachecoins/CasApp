import { useEffect } from 'react'
import { api } from '@/lib/api'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

export function usePushNotifications(isAuthenticated: boolean) {
  useEffect(() => {
    if (!isAuthenticated) return
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'denied') return

    const register = async () => {
      try {
        const { data: keyData } = await api.get('/notifications/vapid-public-key')
        if (!keyData?.data) return // push not configured on server

        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        if (existing) return // already subscribed

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyData.data),
        })

        await api.post('/notifications/subscribe', subscription.toJSON())
      } catch (err) {
        // Silent — push is optional
        console.debug('[Push] Registration skipped:', err)
      }
    }

    register()
  }, [isAuthenticated])
}
