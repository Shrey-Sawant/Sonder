import React, { useState } from 'react';
import { HashRouter } from 'react-router-dom';
import Navigation from './src/components/Navigation';
import ThemeToggle from './src/components/ThemeToggle';
import Dashboard from './src/pages/Dashboard';
import Companion from './src/pages/Companion';
import Sanctuary from './src/pages/Sanctuary';
import Connect from './src/pages/Connect';
import Insight from './src/pages/Insight';
import { ViewState } from './types';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);

  const renderView = () => {
    switch (currentView) {
      case ViewState.DASHBOARD: return <Dashboard setView={setCurrentView} />;
      case ViewState.COMPANION: return <Companion />;
      case ViewState.SANCTUARY: return <Sanctuary />;
      case ViewState.CONNECT: return <Connect />;
      case ViewState.INSIGHT: return <Insight />;
      default: return <Dashboard setView={setCurrentView} />;
    }
  };

  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100">
        
        <Navigation currentView={currentView} setView={setCurrentView} />

        <main className="md:ml-20 lg:ml-64 min-h-screen relative">
          {/* Top Bar for Mobile/Tablet Title or Context & Theme Toggle */}
          <div className="sticky top-0 z-40 bg-zinc-50/80 dark:bg-zinc-950/80 backdrop-blur-sm p-4 md:p-6 flex justify-between items-center">
             <div className="md:hidden flex items-center gap-2">
                <div className="w-6 h-6 bg-gradient-to-tr from-orange-400 to-rose-500 rounded-full"></div>
                <span className="font-bold text-xl tracking-tighter">Sonder.</span>
             </div>
             <div className="ml-auto">
               <ThemeToggle />
             </div>
          </div>

          {/* Page Content */}
          <div className="px-4 pb-24 md:px-8 md:pb-8 max-w-7xl mx-auto">
            {renderView()}
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;