import React, { useEffect, useMemo, useState } from 'react';
import { httpClient } from '../services/httpClient';
import type { CreatePriorAuthRequestInput, PriorAuthorizationRequest } from '../types';

const initialFormState: CreatePriorAuthRequestInput = {
  procedureCode: '',
  referringProvider: '',
  clinicalJustification: '',
  preferredFacility: '',
};

export const PriorAuthForm: React.FC = () => {
  const [requests, setRequests] = useState<PriorAuthorizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<CreatePriorAuthRequestInput>(initialFormState);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.requestId === selectedRequestId) || null,
    [requests, selectedRequestId]
  );

  const loadRequests = async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      }

      const result = await httpClient.getPriorAuthRequests();
      setRequests(result.requests);
      setError(null);

      if (result.requests.length > 0 && !selectedRequestId) {
        setSelectedRequestId(result.requests[0].requestId);
      }

      if (selectedRequestId) {
        const stillExists = result.requests.some((request) => request.requestId === selectedRequestId);
        if (!stillExists) {
          setSelectedRequestId(result.requests[0]?.requestId ?? null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process your request.');
      setRequests([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRequests();

    const intervalId = window.setInterval(() => {
      loadRequests(true);
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFormField = (field: keyof CreatePriorAuthRequestInput, value: string) => {
    setFormState((previous) => ({ ...previous, [field]: value }));
  };

  const resetForm = () => {
    setFormState(initialFormState);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError(null);
      setStatusMessage(null);

      const created = await httpClient.createPriorAuthRequest(formState);
      setStatusMessage(`Prior authorization request ${created.requestId} submitted and pending.`);
      resetForm();
      await loadRequests();
      setSelectedRequestId(created.requestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not process your request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualRefresh = async () => {
    setStatusMessage('Refreshing request status...');
    await loadRequests(true);
    setStatusMessage('Prior authorization statuses are up to date.');
  };

  return (
    <section className="prior-auth" aria-labelledby="prior-auth-heading">
      <div className="prior-auth-header-row">
        <h2 id="prior-auth-heading">Prior Authorization</h2>
        <button
          type="button"
          className="btn-refill btn-secondary"
          onClick={handleManualRefresh}
          disabled={refreshing || loading}
          aria-label="Refresh prior authorization statuses"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Status'}
        </button>
      </div>

      {statusMessage && (
        <p className="success-message" role="status" aria-live="polite">
          {statusMessage}
        </p>
      )}

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <div className="prior-auth-layout">
        <form className="prior-auth-form" onSubmit={handleSubmit} aria-label="Submit prior authorization request">
          <h3>Submit New Request</h3>

          <label htmlFor="procedureCode">Procedure Code</label>
          <input
            id="procedureCode"
            name="procedureCode"
            required
            maxLength={32}
            value={formState.procedureCode}
            onChange={(event) => updateFormField('procedureCode', event.target.value)}
          />

          <label htmlFor="referringProvider">Referring Provider</label>
          <input
            id="referringProvider"
            name="referringProvider"
            required
            maxLength={120}
            value={formState.referringProvider}
            onChange={(event) => updateFormField('referringProvider', event.target.value)}
          />

          <label htmlFor="clinicalJustification">Clinical Justification</label>
          <textarea
            id="clinicalJustification"
            name="clinicalJustification"
            required
            maxLength={500}
            rows={5}
            value={formState.clinicalJustification}
            onChange={(event) => updateFormField('clinicalJustification', event.target.value)}
          />
          <p className="hint-text" aria-live="polite">
            {formState.clinicalJustification.length}/500 characters
          </p>

          <label htmlFor="preferredFacility">Preferred Facility</label>
          <input
            id="preferredFacility"
            name="preferredFacility"
            required
            maxLength={120}
            value={formState.preferredFacility}
            onChange={(event) => updateFormField('preferredFacility', event.target.value)}
          />

          <button type="submit" className="btn-refill" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Prior Authorization'}
          </button>
        </form>

        <div className="prior-auth-list" aria-live="polite">
          <h3>My Requests</h3>

          {loading ? (
            <div className="loading" role="status">Loading prior authorization requests...</div>
          ) : requests.length === 0 ? (
            <div className="empty">No prior authorization requests yet. Submit one to get started.</div>
          ) : (
            <ul className="prior-auth-items">
              {requests.map((request) => (
                <li key={request.requestId} className="prior-auth-item">
                  <button
                    type="button"
                    className={`prior-auth-select ${selectedRequestId === request.requestId ? 'active' : ''}`}
                    onClick={() => setSelectedRequestId(request.requestId)}
                    aria-label={`Open request ${request.requestId}`}
                  >
                    <span className="request-id">{request.requestId}</span>
                    <span className={`status-badge status-${request.status}`}>{request.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {selectedRequest && (
        <article className={`prior-auth-detail status-${selectedRequest.status}`} aria-labelledby="prior-auth-detail-heading">
          <h3 id="prior-auth-detail-heading">Request Details</h3>
          <p><strong>Request ID:</strong> {selectedRequest.requestId}</p>
          <p><strong>Status:</strong> {selectedRequest.status}</p>
          <p><strong>Procedure Code:</strong> {selectedRequest.procedureCode}</p>
          <p><strong>Referring Provider:</strong> {selectedRequest.referringProvider}</p>
          <p><strong>Preferred Facility:</strong> {selectedRequest.preferredFacility}</p>
          <p><strong>Submitted:</strong> {new Date(selectedRequest.createdAt).toLocaleString()}</p>

          {selectedRequest.status === 'denied' && (
            <div className="denial-details" role="note" aria-label="Denial details">
              <p><strong>Denial Reason Code:</strong> {selectedRequest.denialReasonCode}</p>
              <p><strong>Reason:</strong> {selectedRequest.denialReason}</p>
              <p><strong>Appeal Instructions:</strong> {selectedRequest.appealInstructions}</p>
            </div>
          )}
        </article>
      )}
    </section>
  );
};
