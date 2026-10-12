import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import App from './App'
import './index.css'

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {publishableKey ? <ClerkProvider publishableKey={publishableKey}><App /></ClerkProvider> : <App />}
    </BrowserRouter>
  </StrictMode>,
)
