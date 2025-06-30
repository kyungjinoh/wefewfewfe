import { useAuth } from '../AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

// Allowed unique IDs
const ALLOWED_UNIQUE_IDS = [
  'a8fe96d1-4c64-4b99-88ce-7ea243c4bc03',
  '1f36528c-9e00-4196-8f2f-d0e1bfe0fc46',
  '62f2f93d-bfa6-4c86-86d5-94c6c1c6a0b6',
  'f7e6f0ce-9f43-49d3-bcae-76f2e6a473e2',
  '3d7e9280-cd53-4707-8b92-bc9ed22e0d98',
  '4f1bdfae-4c8b-4bb9-930f-83561bb7b260',
  '9cdde155-2f46-4a79-9dfc-6e29e69ea403',
  '32f1e358-951e-41be-97ce-3f78b017efb0',
  '9aefee8f-f7c6-4492-b65f-5fa154bd4640',
  'd2e8c984-1a34-4c3a-a6bc-ec88b5eecb34',
  'b08a43c3-7b5d-41d1-8e06-e5b3433fd901',
  '8b594b20-b4d2-4fc9-812c-10c3159cb249',
  'f5dc36cd-1276-4c76-8541-3ad61020987e',
  '417e3b57-b254-4f44-b982-41b9ec6cb9e2',
  '8f5e402c-3c3e-403b-974f-b27f05029126',
  '78cb5e43-7800-41f3-a0bc-2c61c13e1f8c',
  'b26b8575-69e9-470e-8a2e-3eb71b0b8c7f',
  '5dcf8c89-cdfb-4f4e-8d41-e2b8fd387edf',
  'f7b91468-8f35-4f68-a46c-96120de6f78d',
  'd7f37fe1-5e61-43e7-a5d7-3b1f5dfc7e1c'
];

// Routes that require access control
const RESTRICTED_ROUTES = [
  '/dashboard',
  '/dashboard/log-reaction',
  '/dashboard/history',
  '/dashboard/analysis'
];

export const useAccessControl = (checkAccess: boolean = true) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [uniqueId, setUniqueId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isRestrictedRoute = RESTRICTED_ROUTES.includes(location.pathname);

  // Fetch uniqueId from Firestore
  useEffect(() => {
    let ignore = false;
    const fetchUniqueId = async () => {
      if (user && isRestrictedRoute) {
        try {
          const userDoc = doc(db, 'users', user.uid);
          const userSnap = await getDoc(userDoc);
          if (!ignore) {
            setUniqueId(userSnap.exists() ? userSnap.data().uniqueId || null : null);
          }
        } catch (e) {
          if (!ignore) setUniqueId(null);
        } finally {
          if (!ignore) setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    fetchUniqueId();
    return () => { ignore = true; };
  }, [user, isRestrictedRoute]);

  const hasAccess = !isRestrictedRoute || (uniqueId && ALLOWED_UNIQUE_IDS.includes(uniqueId));

  // Redirect if not allowed (after loading)
  useEffect(() => {
    if (!loading && checkAccess && isRestrictedRoute) {
      if (!user) {
        navigate('/signin');
      } else if (!hasAccess) {
        navigate('/dashboard');
      }
    }
  }, [loading, checkAccess, isRestrictedRoute, hasAccess, user, navigate]);

  return {
    user,
    hasAccess,
    redirectIfNoAccess: () => {}, // not used anymore, kept for compatibility
    ALLOWED_UNIQUE_IDS,
    isRestrictedRoute,
    uniqueId,
    loading
  };
}; 