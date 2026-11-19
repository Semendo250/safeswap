import { lazy, Suspense, useContext, useEffect } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ListingDetail from './pages/ListingDetail';

// Loads a page only when it is opened. If a new version was deployed while this tab was open,
// the old file is gone, so reload once to pick up the new version.
function lazyPage(loader) {
  return lazy(() =>
    loader()
      .then((m) => {
        try {
          sessionStorage.removeItem('chunk-reloaded');
        } catch (e) {
          // storage unavailable, ignore
        }
        return m;
      })
      .catch((err) => {
        let already = false;
        try {
          already = !!sessionStorage.getItem('chunk-reloaded');
          if (!already) sessionStorage.setItem('chunk-reloaded', '1');
        } catch (e) {
          already = true;
        }
        if (!already) {
          window.location.reload();
          return new Promise(() => {});
        }
        throw err;
      })
  );
}

const VerifyOtp = lazyPage(() => import('./pages/VerifyOtp'));
const CreateListing = lazyPage(() => import('./pages/CreateListing'));
const ChatRoute = lazyPage(() => import('./pages/ChatRoute'));
const SellerProfile = lazyPage(() => import('./pages/SellerProfile'));
const Inbox = lazyPage(() => import('./pages/Inbox'));
const ForgotPassword = lazyPage(() => import('./pages/ForgotPassword'));
const ResetPassword = lazyPage(() => import('./pages/ResetPassword'));
const Profile = lazyPage(() => import('./pages/Profile'));
const Terms = lazyPage(() => import('./pages/Terms'));
const Privacy = lazyPage(() => import('./pages/Privacy'));
const Support = lazyPage(() => import('./pages/Support'));
const MyComplaints = lazyPage(() => import('./pages/MyComplaints'));
const MyPurchases = lazyPage(() => import('./pages/MyPurchases'));
const Saved = lazyPage(() => import('./pages/Saved'));
const ReportListing = lazyPage(() => import('./pages/ReportListing'));
const ComplaintThread = lazyPage(() => import('./pages/ComplaintThread'));
const Requests = lazyPage(() => import('./pages/Requests'));
const RequestDetail = lazyPage(() => import('./pages/RequestDetail'));

const Dashboard = lazyPage(() => import('./pages/admin/Dashboard'));
const FlaggedQueue = lazyPage(() => import('./pages/admin/FlaggedQueue'));
const VerificationQueue = lazyPage(() => import('./pages/admin/VerificationQueue'));
const BlacklistManager = lazyPage(() => import('./pages/admin/BlacklistManager'));
const Users = lazyPage(() => import('./pages/admin/Users'));
const Listings = lazyPage(() => import('./pages/admin/Listings'));
const Payments = lazyPage(() => import('./pages/admin/Payments'));
const Finance = lazyPage(() => import('./pages/admin/Finance'));
const Activity = lazyPage(() => import('./pages/admin/Activity'));
const Disputes = lazyPage(() => import('./pages/admin/Disputes'));
const Offers = lazyPage(() => import('./pages/admin/Offers'));
const Broadcast = lazyPage(() => import('./pages/admin/Broadcast'));
const SafeZones = lazyPage(() => import('./pages/admin/SafeZones'));
const Reports = lazyPage(() => import('./pages/admin/Reports'));
const Reviews = lazyPage(() => import('./pages/admin/Reviews'));
const Blocks = lazyPage(() => import('./pages/admin/Blocks'));
const AdminRequests = lazyPage(() => import('./pages/admin/Requests'));

// Opens every new page at the top, so footer links don't land halfway down
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function StudentOnly({ children }) {
  const { user, loading } = useContext(AuthContext);
  if (loading) return null;
  if (user?.role === 'admin') return <Navigate to="/admin" replace />;
  return children;
}

function PageLoading() {
  return <p style={{ padding: '1rem', color: 'var(--color-muted)' }}>Loading...</p>;
}

function App() {
  const { pathname } = useLocation();
  const { user } = useContext(AuthContext);
  const hideFooter =
    user?.role === 'admin' ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/chat') ||
    pathname === '/messages';

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />
      <div className="app-main">
        <Suspense fallback={<PageLoading />}>
          <Routes>
            <Route path="/profile" element={<Profile />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/messages" element={<Inbox />} />
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/verification" element={<VerificationQueue />} />
            <Route path="/admin/listings" element={<Listings />} />
            <Route path="/admin/flagged" element={<FlaggedQueue />} />
            <Route path="/admin/payments" element={<Payments />} />
            <Route path="/admin/finance" element={<Finance />} />
            <Route path="/admin/blacklist" element={<BlacklistManager />} />
            <Route path="/admin/disputes" element={<Disputes />} />
            <Route path="/admin/offers" element={<Offers />} />
            <Route path="/admin/broadcast" element={<Broadcast />} />
            <Route path="/admin/safe-zones" element={<SafeZones />} />
            <Route path="/admin/activity" element={<Activity />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/admin/reviews" element={<Reviews />} />
            <Route path="/admin/blocks" element={<Blocks />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/requests/:id" element={<RequestDetail />} />
            <Route path="/" element={<Landing />} />
            <Route path="/browse" element={<Browse />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-otp" element={<VerifyOtp />} />
            <Route path="/create-listing" element={<CreateListing />} />
            <Route path="/listings/:id" element={<ListingDetail />} />
            <Route path="/chat/:listingId" element={<ChatRoute />} />
            <Route path="/sellers/:id" element={<SellerProfile />} />
            <Route path="/terms" element={<StudentOnly><Terms /></StudentOnly>} />
            <Route path="/privacy" element={<StudentOnly><Privacy /></StudentOnly>} />
            <Route path="/support" element={<StudentOnly><Support /></StudentOnly>} />
            <Route path="/my-purchases" element={<StudentOnly><MyPurchases /></StudentOnly>} />
            <Route path="/saved" element={<StudentOnly><Saved /></StudentOnly>} />
            <Route path="/requests" element={<StudentOnly><Requests /></StudentOnly>} />
            <Route path="/report/:id" element={<StudentOnly><ReportListing /></StudentOnly>} />
            <Route path="/my-complaints" element={<StudentOnly><MyComplaints /></StudentOnly>} />
            <Route path="/my-complaints/:id" element={<StudentOnly><ComplaintThread /></StudentOnly>} />
          </Routes>
        </Suspense>
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default App;