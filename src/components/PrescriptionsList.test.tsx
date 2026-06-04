import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PrescriptionsList } from './PrescriptionsList';
import { httpClient } from '../services/httpClient';
import type { Prescription } from '../types';

vi.mock('../services/httpClient', () => ({
  httpClient: {
    getPrescriptions: vi.fn(),
    refillPrescription: vi.fn(),
    cancelRefillPrescription: vi.fn(),
  },
}));

const mockedClient = vi.mocked(httpClient);

const basePrescription: Prescription = {
  prescriptionId: 'RX-70001',
  memberId: 'M-10001',
  medicationName: 'Lisinopril 10mg',
  dosage: '1 tablet daily',
  lastFilledDate: 'Recent',
  refillsRemaining: 3,
  prescriptionStatus: 'active',
  refillStatus: 'eligible',
  refillStatusReason: 'AVAILABLE',
  pendingRefillRequestedAt: null,
};

describe('PrescriptionsList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders prescriptions and available actions', async () => {
    mockedClient.getPrescriptions.mockResolvedValue([basePrescription]);

    render(<PrescriptionsList />);

    expect(await screen.findByRole('heading', { name: /prescriptions/i })).toBeInTheDocument();
    expect(screen.getByText('Lisinopril 10mg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request refill for lisinopril 10mg/i })).toBeInTheDocument();
  });

  it('renders an empty state', async () => {
    mockedClient.getPrescriptions.mockResolvedValue([]);

    render(<PrescriptionsList />);

    expect(await screen.findByText(/no active prescriptions to manage/i)).toBeInTheDocument();
  });

  it('announces load failures', async () => {
    mockedClient.getPrescriptions.mockRejectedValue(new Error('We could not process your request.'));

    render(<PrescriptionsList />);

    expect(await screen.findByRole('alert')).toHaveTextContent('We could not process your request.');
  });

  it('requests a refill and shows confirmation', async () => {
    mockedClient.getPrescriptions.mockResolvedValue([basePrescription]);
    mockedClient.refillPrescription.mockResolvedValue({
      success: true,
      refillStatus: 'pending',
      message: 'Refill request submitted.',
      code: null,
      duplicate: false,
    });

    const user = userEvent.setup();
    render(<PrescriptionsList />);

    await user.click(await screen.findByRole('button', { name: /request refill for lisinopril 10mg/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Refill request submitted.');
    });
  });

  it('cancels a pending refill and shows confirmation', async () => {
    mockedClient.getPrescriptions.mockResolvedValue([
      {
        ...basePrescription,
        refillStatus: 'pending',
        refillStatusReason: 'ALREADY_PENDING',
        pendingRefillRequestedAt: '2026-06-04T09:30:00.000Z',
      },
    ]);
    mockedClient.cancelRefillPrescription.mockResolvedValue({
      success: true,
      refillStatus: 'eligible',
      message: 'Pending refill canceled.',
      code: null,
      duplicate: false,
    });

    const user = userEvent.setup();
    render(<PrescriptionsList />);

    await user.click(await screen.findByRole('button', { name: /cancel refill for lisinopril 10mg/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Pending refill canceled.');
    });
  });
});