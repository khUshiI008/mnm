import { navigate } from '../navigation/navigationRef';
import { triggerFestivalGreetingRecheck } from '../components/FestivalGreetingModal';
import { showTargetRemarkFromNotification } from '../components/TargetRemarkModal';
import { showGurpurabVideoFromNotification } from '../components/GurpurabVideoModal';

export type TappedNotification = {
  type: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown> | null;
};

/**
 * Employee-side counterpart to adminNotificationRouter.ts — deliberately
 * simpler, since employee navigation is a real react-navigation tree
 * (navigationRef.ts already reaches it directly, unlike AdminShell's custom
 * stack), and every employee screen this points at (Leaves, Advances,
 * Target) is a flat/aggregate view with no per-id detail or scroll-to-row
 * capability today — so "deep link" here means landing on the right tab,
 * not highlighting one specific row.
 */
export function handleEmployeeNotificationTap(n: TappedNotification) {
  switch (n.type) {
    case 'LeaveDecision':
      navigate('Leaves');
      break;
    case 'SalaryAdvanceDecision':
      navigate('Advances');
      break;
    case 'TargetCompleted':
      navigate('Target');
      break;
    case 'TargetRemarks':
      navigate('Target');
      if (n.title && n.body) showTargetRemarkFromNotification({ title: n.title, body: n.body });
      break;
    case 'Birthday':
    case 'Anniversary':
      navigate('Dashboard');
      break;
    case 'FestivalGreeting':
    case 'MorningQuote':
      navigate('Dashboard');
      triggerFestivalGreetingRecheck();
      break;
    case 'GurpurabGreeting':
      navigate('Dashboard');
      showGurpurabVideoFromNotification();
      break;
    case 'ArticlePictureRequest':
      // Admin asked for a picture of one Article — open the upload screen on it.
      navigate('Dashboard', {
        screen: 'ArticlePicture',
        params: { brandId: n.data?.brandId != null ? Number(n.data.brandId) : undefined, articleNo: n.data?.articleNo as string | undefined },
      });
      break;
    default:
      break;
  }
}
