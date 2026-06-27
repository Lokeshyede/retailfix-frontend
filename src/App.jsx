import { useState, useEffect, Suspense, lazy } from 'react';
import TopBar from './components/TopBar';
import { ToastProvider } from './components/Toast';
import NetworkErrorScreen from './components/NetworkErrorScreen';

const Builder = lazy(() => import('./views/Builder'));
const Catalog = lazy(() => import('./views/Catalog'));
const Saved = lazy(() => import('./views/Saved'));
const Customers = lazy(() => import('./views/Customers'));
const Settings = lazy(() => import('./views/Settings'));

export default function App() {
  const [activeView, setActiveView] = useState('builder');
  const [savedRefreshKey, setSavedRefreshKey] = useState(0);
  const [editQuote, setEditQuote] = useState(null);
  const [hasNetworkError, setHasNetworkError] = useState(false);

  useEffect(() => {
    const handleNetworkError = () => setHasNetworkError(true);
    window.addEventListener('network-error', handleNetworkError);
    return () => window.removeEventListener('network-error', handleNetworkError);
  }, []);

  const handleQuoteSaved = () => {
    setSavedRefreshKey(k => k + 1);
    setEditQuote(null);
  };

  const handleModifyQuote = (quote) => {
    setEditQuote(quote);
    setActiveView('builder');
  };

  if (hasNetworkError) {
    return <NetworkErrorScreen onRetry={() => {
      setHasNetworkError(false);
      window.location.reload();
    }} />;
  }

  return (
    <ToastProvider>
      <TopBar activeView={activeView} onSwitch={setActiveView} />
      <main>
        <Suspense fallback={<div className="spinner-wrap"><div className="spinner"></div></div>}>
          {activeView === 'builder' && (
            <Builder 
              onQuoteSaved={handleQuoteSaved} 
              editQuote={editQuote} 
              clearEditQuote={() => setEditQuote(null)} 
            />
          )}
          {activeView === 'catalog' && <Catalog />}
          {activeView === 'saved' && (
            <Saved 
              refreshKey={savedRefreshKey} 
              onModify={handleModifyQuote} 
            />
          )}
          {activeView === 'customers' && <Customers />}
          {activeView === 'settings' && <Settings />}
        </Suspense>
      </main>
    </ToastProvider>
  );
}
