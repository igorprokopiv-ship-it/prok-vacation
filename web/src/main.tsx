import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppDialogProvider } from '@/components/AppDialogs'
import App from './App.tsx'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppDialogProvider>
      <App />
    </AppDialogProvider>
  </StrictMode>,
)
