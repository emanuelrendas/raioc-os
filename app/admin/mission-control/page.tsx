'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const MissionControlDashboard = dynamic(
  () => import('../../../src/pages/admin/mission-control.jsx'),
  { ssr: false }
);

export default function MissionControlPage() {
  return <MissionControlDashboard />;
}
