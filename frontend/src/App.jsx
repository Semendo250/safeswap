import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import Browse from './pages/Browse';
import Login from './pages/Login';
import Signup from './pages/Signup';
import VerifyOtp from './pages/VerifyOtp';
import CreateListing from './pages/CreateListing';
import ListingDetail from './pages/ListingDetail';
import Chat from './pages/Chat';
import SellerProfile from './pages/SellerProfile';
import Dashboard from './pages/admin/Dashboard';
import FlaggedQueue from './pages/admin/FlaggedQueue';
import VerificationQueue from './pages/admin/VerificationQueue';
import BlacklistManager from './pages/admin/BlacklistManager';
import Users from './pages/admin/Users';
import Listings from './pages/admin/Listings';
import Payments from './pages/admin/Payments';
import Activity from './pages/admin/Activity';
import Disputes from './pages/admin/Disputes';
import Broadcast from './pages/admin/Broadcast';
import SafeZones from './pages/admin/SafeZones';
import Inbox from './pages/Inbox';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Support from './pages/Support';
import MyComplaints from './pages/MyComplaints';
import ComplaintThread from './pages/ComplaintThread';

// Opens every new page at the top, so footer links don't land halfway down
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  const { pathname } = useLocation();
  // No footer on the full-screen chat/inbox or the admin pages
  const hideFooter = pathname.startsWith('/admin') || pathname.startsWith('/chat') || pathname === '/messages';

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Navbar />
      <div className="app-main">
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
          <Route path="/admin/blacklist" element={<BlacklistManager />} />
          <Route path="/admin/disputes" element={<Disputes />} />
          <Route path="/admin/broadcast" element={<Broadcast />} />
          <Route path="/admin/safe-zones" element={<SafeZones />} />
          <Route path="/admin/activity" element={<Activity />} />
          <Route path="/" element={<Landing />} />
          <Route path="/browse" element={<Browse />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/create-listing" element={<CreateListing />} />
          <Route path="/listings/:id" element={<ListingDetail />} />
          <Route path="/chat/:listingId" element={<Chat />} />
          <Route path="/sellers/:id" element={<SellerProfile />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/support" element={<Support />} />
                    <Route path="/my-complaints" element={<MyComplaints />} />
          <Route path="/my-complaints/:id" element={<ComplaintThread />} />
        </Routes>
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default App;