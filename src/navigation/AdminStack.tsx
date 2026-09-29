import React from 'react';
import AdminShell from './AdminShell';

/**
 * Admin/HR side of the app — sidebar/topbar/bottom-nav shell matching
 * Panel/Dashboard.Master, module list from adminModules.ts (30 Panel/*
 * pages). Real screens are registered in AdminShell.ADMIN_SCREENS as each
 * module ships; everything else falls through to ComingSoonScreen.
 */
export default function AdminStack() {
  return <AdminShell />;
}
