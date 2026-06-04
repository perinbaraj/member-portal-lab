import React, { useState, useEffect } from 'react';
import type { Prescription } from '../types';
import { httpClient } from '../services/httpClient';

export const PrescriptionsList: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPrescriptions = async () => {
    try {
      const data = await httpClient.getPrescriptions();
      setPrescriptions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process your request.');
      setPrescriptions([]);
    }
  };

  useEffect(() => {
    loadPrescriptions().finally(() => setLoading(false));
  }, []);

  const handleRefill = async (prescriptionId: string) => {
    try {
      setActiveActionId(prescriptionId);
      setStatusMessage(null);
      const result = await httpClient.refillPrescription(prescriptionId);
      setStatusMessage(result.message);
      await loadPrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process your request.');
    } finally {
      setActiveActionId(null);
    }
  };

  const handleCancel = async (prescriptionId: string) => {
    try {
      setActiveActionId(prescriptionId);
      setStatusMessage(null);
      const result = await httpClient.cancelRefillPrescription(prescriptionId);
      setStatusMessage(result.message);
      await loadPrescriptions();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process your request.');
    } finally {
      setActiveActionId(null);
    }
  };

  if (loading) {
    return <div className="loading" role="status">Loading prescriptions...</div>;
  }

  if (error) {
    return <div className="error" role="alert">{error}</div>;
  }

  if (prescriptions.length === 0) {
    return <div className="empty">No active prescriptions to manage.</div>;
  }

  return (
    <section className="prescriptions-list" aria-labelledby="prescriptions-heading">
      <h2 id="prescriptions-heading">Prescriptions</h2>
      {statusMessage && (
        <div className="success-message" role="status" aria-live="polite">
          {statusMessage}
        </div>
      )}
      {prescriptions.map((rx) => (
        <article
          key={rx.prescriptionId}
          className={`prescription-card status-${rx.refillStatus}`}
        >
          <div className="prescription-header">
            <h3>{rx.medicationName}</h3>
            <span className={`status-badge status-${rx.refillStatus}`}>{rx.refillStatus}</span>
          </div>
          <div className="prescription-details">
            <p><strong>Dosage:</strong> {rx.dosage}</p>
            <p><strong>Last Filled:</strong> {rx.lastFilledDate}</p>
            <p><strong>Refills Remaining:</strong> {rx.refillsRemaining}</p>
            <p><strong>Prescription Status:</strong> {rx.prescriptionStatus}</p>
          </div>
          <p className="prescription-helper-text">
            {rx.refillStatus === 'eligible' && 'Ready for refill.'}
            {rx.refillStatus === 'pending' && 'Refill pending. You can still cancel.'}
            {rx.refillStatus === 'processing' && 'Refill in progress and can no longer be canceled.'}
            {rx.refillStatus === 'ineligible' && 'This prescription cannot be refilled right now.'}
          </p>
          {rx.refillStatus === 'eligible' && (
            <div className="prescription-actions">
              <button
                onClick={() => handleRefill(rx.prescriptionId)}
                disabled={activeActionId === rx.prescriptionId}
                className="btn-refill"
                aria-label={`Request refill for ${rx.medicationName}`}
              >
                {activeActionId === rx.prescriptionId ? 'Processing...' : 'Request Refill'}
              </button>
            </div>
          )}
          {rx.refillStatus === 'pending' && (
            <div className="prescription-actions">
              <button
                onClick={() => handleCancel(rx.prescriptionId)}
                disabled={activeActionId === rx.prescriptionId}
                className="btn-refill btn-secondary"
                aria-label={`Cancel refill for ${rx.medicationName}`}
              >
                {activeActionId === rx.prescriptionId ? 'Processing...' : 'Cancel Request'}
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
};
