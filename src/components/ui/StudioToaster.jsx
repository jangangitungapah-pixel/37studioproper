import { Toaster } from 'sonner';
import { useTheme } from '../../theme/ThemeProvider.jsx';

export default function StudioToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      closeButton
      expand={false}
      position="top-right"
      richColors
      theme={resolvedTheme}
      toastOptions={{
        classNames: {
          toast: 'studio-toast',
          title: 'studio-toast-title',
          description: 'studio-toast-description',
        },
      }}
      visibleToasts={4}
    />
  );
}
