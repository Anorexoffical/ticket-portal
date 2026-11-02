import { useLocation, useNavigate, useParams as routerParams, useSearchParams as routerSearchParams } from 'react-router-dom';
export function useParams() { return routerParams(); }
export function useSearchParams() { return routerSearchParams()[0]; }
export function usePathname() { return useLocation().pathname; }
export function useRouter() {
  const navigate = useNavigate();
  return { push: navigate, replace: (to) => navigate(to, { replace: true }), back: () => navigate(-1) };
}
