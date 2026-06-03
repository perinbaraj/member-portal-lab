import React, { useState, useEffect } from 'react';
import type { Prescription } from '../types';
import { httpClient } from '../services/httpClient';

export const PrescriptionsList: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refilling, setRefilling] = useState<string | null>(null);
  const [refillSuccess, setRefillSuccess] = useState<string | null>(null);

  useEffect(() => {
    httpClient.getPrescriptions()
      .then((data) => { setPrescriptions(data); setError(null); })
      .catch((err) => { setError(err.message); setPrescriptions([]); })
      .finally(() => setLoading(false));
  }, []);

  const handleRefill = async (prescriptionId: string) => {
    try {
      setRefilling(prescriptionId);
      await httpClient.refillPrescription(prescriptionId);
      setRefillSuccess(prescriptionId);
      setTimeout(() => setRefillSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refill');
    } finally {
      setRefilling(null);
    }
  };

  if (loading) return <div className="loading">Loading prescriptions...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (prescriptions.length === 0) return <div className="empty">No prescriptions found</div>;

  return (
    <div className="prescriptions-list">
      <h2>Prescriptions</h2>
      {prescriptions.map((rx) => (
        <div key={rx.prescriptionId} className={`prescription-card status-${rx.status}`}>
          <div className="prescription-header">
            <h3>{rx.medicationName}</h3>
            <span className={`status-badge status-${rx.status}`}>{rx.status}</span>
          </div>
          <div className="prescription-details">
            <p><strong>Dosage:</strong> {rx.dosage}</p>
            <p><strong>Last Filled:</strong> {rx.lastFilledDate}</p>
            <p><strong>Refills Remaining:</strong> {rx.refillsRemaining}</p>
          </div>
          {rx.status === 'active' && rx.refillsRemaining > 0 && (
            <div className="prescription-actions">
              <button
                onClick={() => handleRefill(rx.prescriptionId)}
                disabled={refilling === rx.prescriptionId}
                className="btn-refill"
              >
                {refilling === rx.prescriptionId ? 'Processing...' : 'Request Refill'}
              </button>
              {refillSuccess === rx.prescriptionId && (
                <span className="success-message">✓ Refill requested</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
