import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import OperatorHome from './pages/operator/OperatorHome';
import InspectionPage from './pages/operator/InspectionPage';
import AdminLayout from './components/AdminLayout';
import AdminHome from './pages/admin/AdminHome';
import OperatorsAdmin from './pages/admin/OperatorsAdmin';
import OperationsAdmin from './pages/admin/OperationsAdmin';
import TemplatesAdmin from './pages/admin/TemplatesAdmin';
import ReportsAdmin from './pages/admin/ReportsAdmin';

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isQualityAdmin, initialized } = useAuth();
  if (!initialized) return null; // wait for localStorage read
  if (!isAdmin && !isQualityAdmin) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, initialized } = useAuth();
  if (!initialized) return null;
  if (!isAdmin) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
          <Route path="/" element={<OperatorHome />} />
          <Route path="/inspect/:id" element={<InspectionPage />} />
          <Route path="/login" element={<Login />} />

          <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
            <Route index element={<AdminHome />} />
            <Route path="templates" element={<TemplatesAdmin />} />
            <Route path="operations" element={<OperationsAdmin />} />
            <Route path="users" element={<AdminOnlyRoute><OperatorsAdmin /></AdminOnlyRoute>} />
            <Route path="reports" element={<ReportsAdmin />} />
            {/* legacy */}
            <Route path="fields" element={<Navigate to="/admin/templates" replace />} />
            <Route path="operators" element={<AdminOnlyRoute><OperatorsAdmin /></AdminOnlyRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
