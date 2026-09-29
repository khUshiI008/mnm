import { navigateAdminDeepLink } from '../navigation/adminDeepLink';
import { showAdminShayariFromNotification, Daypart } from '../components/MorningGreetingModal';
import { triggerFestivalGreetingRecheck } from '../components/FestivalGreetingModal';
import { showGurpurabVideoFromNotification } from '../components/GurpurabVideoModal';
import { showAdminCelebrationFromNotification } from '../components/AdminCelebrationModal';

export type TappedNotification = {
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
};

function num(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Central "what happens when an admin taps this notification" map — the
 * single place both the in-app bell list (NotificationsModal.tsx) and OS
 * push taps (App.tsx's messaging().onNotificationOpenedApp/getInitialNotification)
 * defer to, so the mapping only needs to be right once. Admin-only by design
 * (per the original request) — callers are responsible for checking
 * user.mode === 'admin' before calling this; employee taps are unaffected.
 *
 * Every case here reuses a screen/popup that already exists — see
 * adminDeepLink.ts's doc comment for why a bridge was needed at all, and
 * each target screen's own `params` handling for how it reacts once there.
 */
export function handleAdminNotificationTap(n: TappedNotification) {
  const data = (n.data || {}) as Record<string, any>;

  switch (n.type) {
    case 'LeaveApplied': {
      const leaveApplicationId = num(data.leaveApplicationId);
      navigateAdminDeepLink('LeaveApproval', leaveApplicationId ? { leaveApplicationId } : undefined);
      break;
    }
    case 'NewRegistration': {
      const employeeId = num(data.employeeId);
      navigateAdminDeepLink('EmployeeRegistrations', employeeId ? { employeeId } : undefined);
      break;
    }
    case 'SalaryAdvanceRequested': {
      const salaryAdvanceId = num(data.salaryAdvanceId);
      navigateAdminDeepLink('SalaryAdvance', salaryAdvanceId ? { salaryAdvanceId } : undefined);
      break;
    }
    case 'LoanRequested': {
      navigateAdminDeepLink('StaffLoans', { initialTab: 'requests' });
      break;
    }
    case 'ImportantEmail': {
      const monitoredEmailId = num(data.monitoredEmailId);
      navigateAdminDeepLink('EmailInbox', monitoredEmailId ? { monitoredEmailId } : undefined);
      break;
    }
    case 'TargetCompleted': {
      navigateAdminDeepLink('TargetAnalysis', {
        salesTargetId: num(data.salesTargetId),
        employeeId: num(data.employeeId),
        salesTargetAchievementId: num(data.salesTargetAchievementId),
      });
      break;
    }
    case 'Birthday':
    case 'Anniversary': {
      // Replaces the old "jump to Employee Form" behavior — a bystander
      // admin viewing someone else's birthday/anniversary wants a wish card
      // with sound, not an edit screen. Falls back to the old navigation if
      // an older push (sent before employeeName was added to the data
      // payload) is somehow tapped, so nothing silently does nothing.
      const employeeId = num(data.employeeId);
      const employeeName = typeof data.employeeName === 'string' ? data.employeeName : null;
      if (employeeName) {
        showAdminCelebrationFromNotification({ type: n.type as 'Birthday' | 'Anniversary', name: employeeName });
      } else if (employeeId) {
        navigateAdminDeepLink('EmployeeForm', { employeeId });
      }
      break;
    }
    case 'AdminShayari': {
      // Re-shows this exact push's own title/body — see
      // showAdminShayariFromNotification's doc comment for why (no
      // fetch-by-id for a specific past sher; the daily API only ever
      // returns *today's*).
      if (n.title && n.body) {
        const daypart = (typeof data.daypart === 'string' ? data.daypart : 'morning') as Daypart;
        showAdminShayariFromNotification({ title: n.title, body: n.body, daypart });
      }
      break;
    }
    case 'FestivalGreeting': {
      // Best-effort: land on the Dashboard and let its own active-greeting
      // check re-show the popup if it's still live — there's no fetch-by-id
      // for a specific (possibly since-retired) greeting.
      navigateAdminDeepLink('AdminDashboard');
      triggerFestivalGreetingRecheck();
      break;
    }
    case 'GurpurabGreeting': {
      showGurpurabVideoFromNotification();
      break;
    }
    default:
      break;
  }
}
