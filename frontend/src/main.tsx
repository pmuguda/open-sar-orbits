import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

// No StrictMode: its double-mount in dev would create and destroy the Cesium
// viewer (WebGL context) and the SGP4 worker twice on every load.
createRoot(document.getElementById('root')!).render(<App />);
