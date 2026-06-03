import type { Member, Prescription, Claim } from '../types';

const API_BASE = '/api';

function getMemberId(): string {
  return localStorage.getItem('memberId') || 'M-10001';
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-member-id': getMemberId() };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export const httpClient = {
  async getMember(): Promise<Member> {
    const res = await fetch(`${API_BASE}/members/me`, { headers: headers() });
    return handleResponse<Member>(res);
  },

  async getPrescriptions(): Promise<Prescription[]> {
    const res = await fetch(`${API_BASE}/prescriptions`, { headers: headers() });
    const data = await handleResponse<{ prescriptions?: Prescription[] }>(res);
    return data.prescriptions || [];
  },

  // NOTE: This endpoint is implemented by participants in Lab 1.
  // The backend route (POST /api/prescriptions/:id/refill) does not exist yet.
  async refillPrescription(id: string): Promise<{ success: boolean }> {
    const res = await fetch(`${API_BASE}/prescriptions/${id}/refill`, {
      method: 'POST',
      headers: headers(),
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getClaims(): Promise<Claim[]> {
    const res = await fetch(`${API_BASE}/claims`, { headers: headers() });
    const data = await handleResponse<{ claims?: Claim[] }>(res);
    return data.claims || [];
  },

  setMemberId(memberId: string): void {
    localStorage.setItem('memberId', memberId);
  },
};
