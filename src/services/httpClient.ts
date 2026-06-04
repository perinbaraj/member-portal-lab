import type { Member, Prescription, Claim, RefillMutationResult } from '../types';

const API_BASE = '/api';

function getMemberId(): string {
  return localStorage.getItem('memberId') || 'M-10001';
}

function headers(): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-member-id': getMemberId() };
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(err.message || 'We could not process your request.');
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

  async refillPrescription(id: string): Promise<RefillMutationResult> {
    const res = await fetch(`${API_BASE}/prescriptions/${id}/refill`, {
      method: 'POST',
      headers: headers(),
    });
    return handleResponse<RefillMutationResult>(res);
  },

  async cancelRefillPrescription(id: string): Promise<RefillMutationResult> {
    const res = await fetch(`${API_BASE}/prescriptions/${id}/refill`, {
      method: 'DELETE',
      headers: headers(),
    });
    return handleResponse<RefillMutationResult>(res);
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
