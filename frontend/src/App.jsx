import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
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
import Inbox from './pages/Inbox';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';

function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/profile" element={<Profile />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
<Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/messages" element={<Inbox />} />
        <Route path="/admin/blacklist" element={<BlacklistManager />} />
        <Route path="/admin/verification" element={<VerificationQueue />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/flagged" element={<FlaggedQueue />} />
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/verify-otp" element={<VerifyOtp />} />
        <Route path="/create-listing" element={<CreateListing />} />
        <Route path="/listings/:id" element={<ListingDetail />} />
        <Route path="/chat/:listingId" element={<Chat />} />
        <Route path="/sellers/:id" element={<SellerProfile />} />
      </Routes>
    </>
  );
}

export default App;