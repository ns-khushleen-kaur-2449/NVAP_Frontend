import { useAuth } from '@/lib/AuthContext';
import { displayTimeZone } from '@/lib/ops';

/** The zone this user's screens show times in (the tenant's default, else IST). */
export default function useDisplayZone() {
  const { user } = useAuth();
  return displayTimeZone(user);
}
