import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { registerSW } from 'virtual:pwa-register'

// Auto-register service worker for PWA offline capabilities & fast caching
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log('Versi baru Higo Pondok tersedia.')
  },
  onOfflineReady() {
    console.log('Higo Pondok siap berjalan secara offline.')
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-center" />
    </QueryClientProvider>
  </StrictMode>,
)
