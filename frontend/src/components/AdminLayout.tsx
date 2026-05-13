import React from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import { Users, Wrench, ListChecks, BarChart3, LogOut, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../types';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { currentUser, canManageUsers, canManageTemplates, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r flex flex-col">
        <div className="p-6 border-b">
          <Link to="/admin" className="flex items-center gap-2">
            <Shield className="w-7 h-7 text-blue-600" />
            <div>
              <div className="font-bold text-lg">QualiTrace</div>
              <div className="text-xs text-gray-500">Panou administrare</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {canManageTemplates && (
            <NavLink to="/admin/templates" className={navClass}>
              <ListChecks className="w-5 h-5" /> Șabloane Calitate
            </NavLink>
          )}
          {canManageTemplates && (
            <NavLink to="/admin/operations" className={navClass}>
              <Wrench className="w-5 h-5" /> Operații
            </NavLink>
          )}
          {canManageUsers && (
            <NavLink to="/admin/users" className={navClass}>
              <Users className="w-5 h-5" /> Personal
            </NavLink>
          )}
          {canManageTemplates && (
            <NavLink to="/admin/reports" className={navClass}>
              <BarChart3 className="w-5 h-5" /> Rapoarte
            </NavLink>
          )}
        </nav>
        <div className="p-4 border-t">
          <div className="mb-3 text-sm">
            <div className="font-medium">{currentUser?.name}</div>
            <div className="text-xs text-gray-500">{currentUser ? ROLE_LABELS[currentUser.role] : ''}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-red-50 text-red-600"
          >
            <LogOut className="w-4 h-4" /> Deconectare
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
  }`;
}
