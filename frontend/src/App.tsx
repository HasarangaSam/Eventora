import { CurrentUserProvider } from './features/auth/current-user-context'
import { ToastProvider } from './components/ui/toast'
import { RoutedApplication } from './app/routes'

export default function App() {
  return (
    <CurrentUserProvider>
      <ToastProvider>
        <RoutedApplication />
      </ToastProvider>
    </CurrentUserProvider>
  )
}
