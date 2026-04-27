import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// When the user is offline, restrict navigation to Home + Library + Offline player.
// All other routes redirect to /home.
const OFFLINE_ALLOWED = new Set<string>(['/home', '/library', '/offline-player', '/auth']);

const isAllowedOfflinePath = (pathname: string): boolean => {
  if (OFFLINE_ALLOWED.has(pathname)) return true;
  // Allow nothing else (no playlist/artist/admin/etc when offline).
  return false;
};

const OfflineGate = () => {
  const { isOffline } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOffline) return;
    if (!isAllowedOfflinePath(location.pathname)) {
      navigate('/home', { replace: true });
    }
  }, [isOffline, location.pathname, navigate]);

  return null;
};

export default OfflineGate;
