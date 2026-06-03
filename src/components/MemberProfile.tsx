import React, { useState, useEffect } from 'react';
import type { Member } from '../types';
import { httpClient } from '../services/httpClient';

export const MemberProfile: React.FC = () => {
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    httpClient.getMember()
      .then((data) => { setMember(data); setError(null); })
      .catch((err) => { setError(err.message); setMember(null); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading member profile...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!member) return <div className="error">No member data</div>;

  return (
    <div className="member-profile">
      <h2>Member Profile</h2>
      <div className="profile-info">
        <p><strong>Name:</strong> {member.firstName} {member.lastName}</p>
        <p><strong>Member ID:</strong> {member.memberId}</p>
        <p><strong>Date of Birth:</strong> {member.dateOfBirth}</p>
        <p><strong>Plan:</strong> {member.planName} ({member.planId})</p>
      </div>
    </div>
  );
};
