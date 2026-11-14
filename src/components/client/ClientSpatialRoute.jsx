import SpatialUiProvider from '../ui/SpatialUiProvider.jsx';
import StudioToaster from '../ui/StudioToaster.jsx';
import { ThemeProvider } from '../../theme/ThemeProvider.jsx';

export default function ClientSpatialRoute({ children }) {
  return (
    <ThemeProvider>
      <SpatialUiProvider>
        <StudioToaster />
        {children}
      </SpatialUiProvider>
    </ThemeProvider>
  );
}
