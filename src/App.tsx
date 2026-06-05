import React, { useState } from 'react';
import { MemberProfile } from './components/MemberProfile';
import { PrescriptionsList } from './components/PrescriptionsList';
import { ClaimsList } from './components/ClaimsList';
import { PriorAuthForm } from './components/PriorAuthForm';
import { httpClient } from './services/httpClient';
import './App.css';

type View = 'profile' | 'prescriptions' | 'claims' | 'prior-auth';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('profile');
  const [memberId, setMemberIdInput] = useState<string>(() => localStorage.getItem('memberId') || 'M-10001');
  const [showAuthDialog, setShowAuthDialog] = useState(false);

  const handleSetMemberId = (id: string) => {
    httpClient.setMemberId(id);
    setMemberIdInput(id);
    setShowAuthDialog(false);
    window.location.reload();
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Member Portal</h1>
        <nav className="app-nav">
          <button
            className={`nav-button ${currentView === 'profile' ? 'active' : ''}`}
            onClick={() => setCurrentView('profile')}
          >
            Profile
          </button>
          <button
            className={`nav-button ${currentView === 'prescriptions' ? 'active' : ''}`}
            onClick={() => setCurrentView('prescriptions')}
          >
            Prescriptions
          </button>
          <button
            className={`nav-button ${currentView === 'claims' ? 'active' : ''}`}
            onClick={() => setCurrentView('claims')}
          >
            Claims
          </button>
          <button
            className={`nav-button ${currentView === 'prior-auth' ? 'active' : ''}`}
            onClick={() => setCurrentView('prior-auth')}
          >
            Prior Auth
          </button>
          <button
            className="nav-button auth-button"
            onClick={() => setShowAuthDialog(!showAuthDialog)}
          >
            Member: {memberId}
          </button>
        </nav>
      </header>

      {showAuthDialog && (
        <div className="auth-dialog">
          <div className="dialog-content">
            <h2>Select Member ID</h2>
            <p>Choose a test member:</p>
            <div className="member-id-options">
              {['M-10001', 'M-10002', 'M-10003'].map((id) => (
                <button
                  key={id}
                  className={`option-button ${memberId === id ? 'active' : ''}`}
                  onClick={() => handleSetMemberId(id)}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="custom-input">
              <label htmlFor="member-id-input">Custom member ID</label>
              <input
                id="member-id-input"
                type="text"
                placeholder="Or enter custom member ID"
                defaultValue={memberId}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value) {
                    handleSetMemberId(e.currentTarget.value);
                  }
                }}
              />
            </div>
            <button className="close-button" onClick={() => setShowAuthDialog(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      <main className="app-main">
        {currentView === 'profile' && <MemberProfile />}
        {currentView === 'prescriptions' && <PrescriptionsList />}
        {currentView === 'claims' && <ClaimsList />}
        {currentView === 'prior-auth' && <PriorAuthForm />}
      </main>

      <footer className="app-footer">
        <p>Member Portal • Lab Starter</p>
      </footer>
    </div>
  );
};
