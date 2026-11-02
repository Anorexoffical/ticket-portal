import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './globals.css';

import Home from './pages/b2b/page.jsx';
import Login from './pages/auth/login/page.jsx';
import Signup from './pages/auth/signup/page.jsx';
import Pending from './pages/auth/pending/page.jsx';
import Voucher from './pages/public/voucher/[id]/page.jsx';

import AgentHome from './pages/b2b/page.jsx';
import B2BFlights from './pages/b2b/flights/page.jsx';
import AgentBookings from './pages/b2b/bookings/page.jsx';
import AgentLedger from './pages/b2b/ledger/page.jsx';
import AgentPay from './pages/b2b/pay/page.jsx';
import AgentSettings from './pages/b2b/settings/page.jsx';
import AgentBook from './pages/b2b/book/[id]/page.jsx';


import AdminLogin from './pages/admin/login/page.jsx';
import AdminHome from './pages/admin/page.jsx';
import AdminAccounts from './pages/admin/accounts/page.jsx';
import AdminActivity from './pages/admin/activity/page.jsx';
import AdminAgents from './pages/admin/agents/page.jsx';
import AdminBookings from './pages/admin/bookings/page.jsx';
import AdminFlights from './pages/admin/flights/page.jsx';
import AdminLedger from './pages/admin/ledger/page.jsx';
import AdminPayments from './pages/admin/payments/page.jsx';
import AdminSales from './pages/admin/sales/page.jsx';
import AdminSettings from './pages/admin/settings/page.jsx';
import AdminStaff from './pages/admin/staff/page.jsx';
import AdminSuppliers from './pages/admin/suppliers/page.jsx';



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/pending" element={<Pending />} />
        <Route path="/voucher/:id" element={<Voucher />} />

        <Route path="/b2b" element={<AgentHome />} />
        <Route path="/b2b/flights" element={<B2BFlights />} />
        <Route path="/agent" element={<Navigate to="/b2b/flights" replace />} />
        <Route path="/agent/bookings" element={<AgentBookings />} />
        <Route path="/agent/ledger" element={<AgentLedger />} />
        <Route path="/agent/pay" element={<AgentPay />} />
        <Route path="/agent/settings" element={<AgentSettings />} />
        <Route path="/agent/book/:id" element={<AgentBook />} />
        <Route path="/b2b/*" element={<Navigate to="/agent" replace />} />

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/accounts" element={<AdminAccounts />} />
        <Route path="/admin/activity" element={<AdminActivity />} />
        <Route path="/admin/agents" element={<AdminAgents />} />
        <Route path="/admin/bookings" element={<AdminBookings />} />
        <Route path="/admin/flights" element={<AdminFlights />} />
        <Route path="/admin/ledger" element={<AdminLedger />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/sales" element={<AdminSales />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/staff" element={<AdminStaff />} />
        <Route path="/admin/suppliers" element={<AdminSuppliers />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
