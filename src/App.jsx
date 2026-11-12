import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import { SessionProvider } from '@/context/SessionContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import AppRoutes from '@/routes';

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster position="bottom-right" richColors theme={theme} />;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SessionProvider>
          <AppRoutes />
          <ThemedToaster />
        </SessionProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
