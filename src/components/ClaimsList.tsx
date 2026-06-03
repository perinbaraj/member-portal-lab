import React, { useState, useEffect } from 'react';
import type { Claim } from '../types';
import { httpClient } from '../services/httpClient';

export const ClaimsList: React.FC = () => {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    httpClient.getClaims()
      .then((data) => { setClaims(data); setError(null); })
      .catch((err) => { setError(err.message); setClaims([]); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading claims...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (claims.length === 0) return <div className="empty">No claims found</div>;

  return (
    <div className="claims-list">
      <h2>Claims</h2>
      {claims.map((claim) => (
        <div key={claim.claimId} className={`claim-card status-${claim.status}`}>
          <div className="claim-header">
            <h3>{claim.providerName}</h3>
            <span className={`status-badge status-${claim.status}`}>{claim.status}</span>
          </div>
          <div className="claim-details">
            <p><strong>Service Date:</strong> {claim.serviceDate}</p>
            <p><strong>Procedure:</strong> {claim.procedureCode}</p>
            <p><strong>Amount:</strong> ${claim.amount.toFixed(2)}</p>
            <p><strong>Claim ID:</strong> {claim.claimId}</p>
          </div>
        </div>
      ))}
    </div>
  );
};
