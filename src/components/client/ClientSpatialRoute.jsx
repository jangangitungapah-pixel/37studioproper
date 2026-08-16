import SpatialUiProvider from '../ui/SpatialUiProvider.jsx';
import { ThemeProvider } from '../../theme/ThemeProvider.jsx';

export default function ClientSpatialRoute({ children }) {
  return (
    <ThemeProvider>
      <SpatialUiProvider>
        {children}
      </SpatialUiProvider>
    </ThemeProvider>
  );
}
