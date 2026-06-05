import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PriorAuthForm } from './PriorAuthForm';
import { httpClient } from '../services/httpClient';
import type { PriorAuthorizationRequest } from '../types';

vi.mock('../services/httpClient', () => ({
  httpClient: {
    getPriorAuthRequests: vi.fn(),
    createPriorAuthRequest: vi.fn(),
  },
}));

const mockedClient = vi.mocked(httpClient);

const pendingRequest: PriorAuthorizationRequest = {
  requestId: 'PAR-10001',
  status: 'pending',
  procedureCode: '27447',
  referringProvider: 'Dr. Alvarez',
  clinicalJustification: 'Persistent knee pain with severe osteoarthritis.',
  preferredFacility: 'Central Ortho Center',
  denialReasonCode: null,
  denialReason: null,
  appealInstructions: null,
  createdAt: '2026-06-04T08:00:00.000Z',
  updatedAt: '2026-06-04T08:00:00.000Z',
};

const deniedRequest: PriorAuthorizationRequest = {
  ...pendingRequest,
  requestId: 'PAR-10002',
  status: 'denied',
  denialReasonCode: 'medical_necessity',
  denialReason: 'Clinical criteria were not met.',
  appealInstructions: 'Contact member services for appeal steps.',
};

describe('PriorAuthForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders requests and denied details', async () => {
    mockedClient.getPriorAuthRequests.mockResolvedValue({
      requests: [deniedRequest],
      page: 1,
      limit: 20,
      total: 1,
    });

    render(<PriorAuthForm />);

    expect(await screen.findByText('My Requests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open request PAR-10002/i })).toBeInTheDocument();
    expect(screen.getByText('medical_necessity')).toBeInTheDocument();
  });

  it('submits a new request and refreshes the list', async () => {
    mockedClient.getPriorAuthRequests
      .mockResolvedValueOnce({ requests: [], page: 1, limit: 20, total: 0 })
      .mockResolvedValueOnce({ requests: [pendingRequest], page: 1, limit: 20, total: 1 });

    mockedClient.createPriorAuthRequest.mockResolvedValue(pendingRequest);

    const user = userEvent.setup();

    render(<PriorAuthForm />);

    await user.type(screen.getByLabelText(/Procedure Code/i), '27447');
    await user.type(screen.getByLabelText(/Referring Provider/i), 'Dr. Alvarez');
    await user.type(screen.getByLabelText(/Clinical Justification/i), 'Persistent knee pain with severe osteoarthritis.');
    await user.type(screen.getByLabelText(/Preferred Facility/i), 'Central Ortho Center');

    await user.click(screen.getByRole('button', { name: /Submit Prior Authorization/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('submitted and pending');
    });

    expect(mockedClient.createPriorAuthRequest).toHaveBeenCalledTimes(1);
    expect(mockedClient.getPriorAuthRequests).toHaveBeenCalledTimes(2);
  });

  it('prevents submit when required fields are missing', async () => {
    mockedClient.getPriorAuthRequests.mockResolvedValue({
      requests: [],
      page: 1,
      limit: 20,
      total: 0,
    });

    const user = userEvent.setup();
    render(<PriorAuthForm />);

    await screen.findByText(/No prior authorization requests yet/i);
    await user.click(screen.getByRole('button', { name: /Submit Prior Authorization/i }));

    expect(mockedClient.createPriorAuthRequest).not.toHaveBeenCalled();
  });

  it('supports 30-second polling and manual refresh', async () => {
    mockedClient.getPriorAuthRequests.mockResolvedValue({
      requests: [pendingRequest],
      page: 1,
      limit: 20,
      total: 1,
    });

    const intervalSpy = vi.spyOn(window, 'setInterval');
    const user = userEvent.setup();
    render(<PriorAuthForm />);

    await screen.findByRole('button', { name: /Open request PAR-10001/i });
    expect(intervalSpy).toHaveBeenCalled();

    const pollCallback = intervalSpy.mock.calls[0]?.[0];
    if (typeof pollCallback === 'function') {
      await act(async () => {
        pollCallback();
      });
    }

    await waitFor(() => {
      expect(mockedClient.getPriorAuthRequests).toHaveBeenCalledTimes(2);
    });

    await user.click(screen.getByRole('button', { name: /Refresh prior authorization statuses/i }));

    await waitFor(() => {
      expect(mockedClient.getPriorAuthRequests).toHaveBeenCalledTimes(3);
    });

    intervalSpy.mockRestore();
  });

  it('renders an empty state', async () => {
    mockedClient.getPriorAuthRequests.mockResolvedValue({
      requests: [],
      page: 1,
      limit: 20,
      total: 0,
    });

    render(<PriorAuthForm />);

    expect(await screen.findByText(/No prior authorization requests yet/i)).toBeInTheDocument();
  });
});
