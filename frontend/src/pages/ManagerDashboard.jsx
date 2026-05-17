import React, { useState, useEffect, useRef } from 'react';

import { 
  Zap, LogOut, User, Activity, Car, ShieldAlert, Users, 
  CheckCircle, XCircle, Clock, RotateCw, Bell, LayoutDashboard, 
  ClipboardList, TrendingUp, PieChart as PieIcon, Cpu, Globe, Circle, Plus, Edit, Trash2, Shield, UserPlus, Search, Key,
  FileText, History
} from 'lucide-react';

import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { useNavigate } from 'react-router-dom';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending'); // Chỉnh tab mặc định cho dễ test
  
  const [kpis, setKpis] = useState({});
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  // --- STATES CHO USER MANAGEMENT ---
  const [usersList, setUsersList] = useState([]);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userFormData, setUserFormData] = useState({
    username: '', password: '', full_name: '', email: '', role: 'citizen',
    phone_number: '', address: '', identity_card_number: '', employee_code: '', department_name: ''
  });

  const isFirstLoad = useRef(true);
  const prevPendingRef = useRef([]);

  // --- STATES CHỨA DỮ LIỆU ĐỘNG CHO BIỂU ĐỒ ---
  const [trafficChartData, setTrafficChartData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);

  // --- STATES CHO ACCESS LOGS ---
  const [accessLogs, setAccessLogs] = useState([]);
  const [logLoading, setLogLoading] = useState(false);
  const [logFilters, setLogFilters] = useState({ license_plate: '', start_date: '', end_date: '' });
  const [logPagination, setLogPagination] = useState({ page: 1, total_pages: 1, total: 0 });

  // --- STATES CHO AUDIT LOGS ---
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const addNotification = (message, type = 'info') => {
    const uniqueId = Date.now() + Math.random(); 
    setNotifications(prev => [{ id: uniqueId, message, type, time: new Date().toLocaleTimeString('vi-VN') }, ...prev]);
  };

  useEffect(() => { 
    fetchDashboardData(); 
    const interval = setInterval(() => fetchDashboardData(true, true), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async (isRefresh = false, isBackground = false) => {
    if (isRefresh && !isBackground) setIsRefreshing(true); 
    if (!isRefresh && !isBackground) setLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      
      // GỌI ĐỒNG THỜI 4 API ĐỂ TỐI ƯU TỐC ĐỘ TẢI TRANG
      const [kpiRes, pendingRes, trafficRes, typesRes] = await Promise.all([
        fetch('http://localhost:5000/api/v1/managers/analytics/overview', { headers }),
        fetch('http://localhost:5000/api/v1/managers/vehicles/pending', { headers }),
        fetch('http://localhost:5000/api/v1/managers/analytics/traffic-by-hour', { headers }),
        fetch('http://localhost:5000/api/v1/managers/analytics/vehicle-types', { headers })
      ]);

      if (kpiRes.status === 403) { alert("LỖI QUYỀN TRUY CẬP!"); navigate('/'); return; }

      // 1. Xử lý dữ liệu danh sách xe chờ duyệt
      if (pendingRes.ok) {
        const pData = await pendingRes.json();
        const newPending = Array.isArray(pData) ? pData : (pData.data?.vehicles || pData.data || []);
        
        if (!isFirstLoad.current) {
            newPending.forEach(nv => {
                const oldV = prevPendingRef.current.find(v => v.vehicle_id === nv.vehicle_id);
                if (!oldV) {
                    if (nv.status === 'pending_new') {
                        addNotification(`🔔 Xe đăng ký mới chờ quản lý duyệt: ${nv.license_plate}`, 'success');
                    } else if (nv.status === 'pending_update') {
                        addNotification(`🔔 Xe chỉnh sửa thông tin chờ quản lý duyệt: ${nv.license_plate}`, 'info');
                    }
                }
            });
        }
        prevPendingRef.current = newPending;
        setPendingVehicles(newPending);
        isFirstLoad.current = false; 
      }
      
      // 2. Xử lý dữ liệu 4 Thẻ KPIs
      if (kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpis(kData?.data || kData || {});
      }

      // 3. Xử lý dữ liệu Biểu đồ xu hướng 24h (AreaChart)
      if (trafficRes.ok) {
        const tData = await trafficRes.json();
        const rawTraffic = tData.data || [];
        const formattedTraffic = rawTraffic.map(item => ({
          time: `${String(item.hour).padStart(2, '0')}:00`,
          flow: parseInt(item.total_entries || item.total || 0, 10)
        }));
        setTrafficChartData(formattedTraffic);
      }

      // 4. Xử lý dữ liệu Biểu đồ cơ cấu loại xe (PieChart Donut)
      if (typesRes.ok) {
        const typeData = await typesRes.json();
        const rawTypes = typeData.data || [];
        const colorsPalette = ['#005B9F', '#FF6B00', '#64748B', '#10B981', '#EF4444'];
        const formattedTypes = rawTypes.map((item, idx) => ({
          name: item.vehicle_type ? item.vehicle_type.charAt(0).toUpperCase() + item.vehicle_type.slice(1) : 'Khác',
          value: parseInt(item.count, 10) || 0,
          color: colorsPalette[idx % colorsPalette.length]
        }));
        setPieChartData(formattedTypes);
      }

    } catch (error) { 
      console.error("Lỗi API Hệ thống:", error); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false); 
    }
  };

  // --- LOGIC GỌI API CHO USER MANAGEMENT ---
  const fetchUsers = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/v1/managers/users', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsersList(data.data || []);
      }
    } catch (e) { console.log("Lỗi fetch users:", e); }
  };

  // Tự động fetch Users khi chuyển sang tab 'users'
  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  // --- LOGIC GỌI API CHO ACCESS LOGS ---
  const fetchAccessLogs = async (page = 1) => {
    setLogLoading(true);
    try {
      const params = new URLSearchParams({ limit: 50, page });
      if (logFilters.license_plate) params.append('license_plate', logFilters.license_plate);
      if (logFilters.start_date) params.append('start_date', logFilters.start_date);
      if (logFilters.end_date) params.append('end_date', logFilters.end_date);
      const res = await fetch(`http://localhost:5000/api/v1/managers/logs?${params}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAccessLogs(data.data?.logs || []);
        setLogPagination(data.data?.pagination || { page: 1, total_pages: 1, total: 0 });
      }
    } catch (e) { console.error('Lỗi fetch access logs:', e); }
    finally { setLogLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'access-logs') fetchAccessLogs(1);
  }, [activeTab]);

  // --- LOGIC GỌI API CHO AUDIT LOGS ---
  const fetchAuditLogs = async (page = 1) => {
    setAuditLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/v1/managers/audit-logs?limit=50&page=${page}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(Array.isArray(data.data) ? data.data : []);
      }
    } catch (e) { console.error('Lỗi fetch audit logs:', e); }
    finally { setAuditLoading(false); }
  };

  useEffect(() => {
    if (activeTab === 'audit-logs') fetchAuditLogs(1);
  }, [activeTab]);

  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormData({ 
      username: '', password: '', full_name: '', email: '', role: 'citizen', 
      phone_number: '', address: '', identity_card_number: '', 
      employee_code: '', department_name: '' 
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username, password: '', full_name: user.full_name, email: user.email || '', role: user.role,
      phone_number: user.phone_number || '', address: user.address || '', 
      identity_card_number: user.identity_card_number || '', // Đã bổ sung
      employee_code: user.employee_code || '', department_name: user.department_name || ''
    });
    setIsUserModalOpen(true);
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      const role_details = {};
      if (userFormData.role === 'citizen') {
        role_details.phone_number = userFormData.phone_number; 
        role_details.address = userFormData.address;
        role_details.identity_card_number = userFormData.identity_card_number; // Bắn CCCD lên API
      } else if (userFormData.role === 'guard') {
        role_details.employee_code = userFormData.employee_code;
      } else if (userFormData.role === 'manager') {
        role_details.department_name = userFormData.department_name;
      }

      const payload = {
        username: userFormData.username, full_name: userFormData.full_name, email: userFormData.email, role_details
      };
      
      if (!editingUser) payload.role = userFormData.role; 
      if (userFormData.password) payload.password = userFormData.password;

      const url = editingUser ? `http://localhost:5000/api/v1/managers/users/${editingUser.user_id}` : 'http://localhost:5000/api/v1/managers/users';
      
      const res = await fetch(url, {
        method: editingUser ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addNotification(editingUser ? 'Cập nhật user thành công' : 'Thêm user mới thành công', 'success');
        fetchUsers();
        setIsUserModalOpen(false);
      } else {
        const err = await res.json();
        addNotification(err.message || 'Lỗi xử lý', 'error');
      }
    } catch (e) { addNotification('Lỗi kết nối', 'error'); }
  };

  const handleDeleteUser = async (id, username) => {
    if (!window.confirm(`Xác nhận XÓA VĨNH VIỄN tài khoản: ${username}?`)) return;
    try {
      const res = await fetch(`http://localhost:5000/api/v1/managers/users/${id}`, {
        method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        addNotification(`Đã xóa tài khoản ${username}`, 'success');
        fetchUsers();
      } else {
        const err = await res.json(); addNotification(err.message, 'error');
      }
    } catch (e) { addNotification('Lỗi kết nối', 'error'); }
  };

  const handleAction = async (vehicleId, actionType, licensePlate) => {
    const isApprove = actionType === 'approve';
    let reason = "Không đạt yêu cầu";

    if (!isApprove) {
        const inputReason = window.prompt(`Nhập lý do từ chối xe ${licensePlate}:`);
        if (inputReason === null) return; 
        if (inputReason.trim() !== "") reason = inputReason;
    } else {
        if (!window.confirm(`Xác nhận DUYỆT xe ${licensePlate}?`)) return;
    }

    try {
      const response = await fetch(`http://localhost:5000/api/v1/managers/vehicles/${vehicleId}/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(isApprove ? {} : { reason: reason })
      });

      if (response.ok) {
        // Cập nhật lại UI Manager và hiện thông báo hành động
        setPendingVehicles(prev => prev.filter(v => v.vehicle_id !== vehicleId));
        if (isApprove) {
             addNotification(`✅ Đã duyệt thành công xe ${licensePlate}`, "success");
        } else {
             addNotification(`❌ Đã từ chối xe ${licensePlate}`, "error");
        }
      } else {
        alert("Có lỗi xảy ra khi xử lý.");
      }
    } catch (error) { alert("Lỗi kết nối!"); }
  };

  const renderPendingSection = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-[#FF6B00]" />
          <h3 className="text-xl font-black text-gray-800">Pending Vehicle Approvals</h3>
        </div>
        <span className="bg-[#FF6B00] text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
          {pendingVehicles.length} Requests
        </span>
      </div>

      <div className="p-0">
        {pendingVehicles.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-200" />
            <p className="text-xl font-bold">All caught up!</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pendingVehicles.map((vehicle) => {
                const displayData = vehicle.status === 'pending_update' && vehicle.pending_changes 
                    ? { ...vehicle, ...vehicle.pending_changes } : vehicle;

                return (
                    <div key={displayData.vehicle_id} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors gap-6">
                        <div className="flex items-start space-x-5 flex-1">
                            <div className="bg-blue-100 text-blue-800 p-3 rounded-xl font-black text-2xl tracking-widest border-2 border-blue-200 shrink-0 min-w-[160px] text-center">
                                {displayData.license_plate}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    {vehicle.status === 'pending_new' && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-blue-200 uppercase tracking-wider">✨ New Registration</span>}
                                    {vehicle.status === 'pending_update' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-200 uppercase tracking-wider">🔄 Info Update</span>}
                                </div>
                                <p className="text-lg font-black text-gray-800">
                                    <span className="text-gray-400 font-bold">Vehicle Type:</span> <span className="capitalize">{displayData.vehicle_type}</span>
                                    <span className="mx-3 text-gray-300">|</span>
                                    <span className="text-gray-400 font-bold">Color:</span> <span className="capitalize">{displayData.vehicle_color}</span>
                                </p>
                                <div className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                                    <User className="w-4 h-4 text-gray-400" /> 
                                    <span className="font-bold text-gray-700">{vehicle.owner_name}</span>
                                    <span className="text-gray-300 mx-1">•</span>
                                    <span className="text-gray-500">{vehicle.owner_address}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex space-x-3 shrink-0">
                            <button onClick={() => handleAction(vehicle.vehicle_id, 'reject', displayData.license_plate)} className="px-5 py-2.5 bg-white text-red-600 hover:bg-red-50 font-bold rounded-lg border border-red-200 transition-all flex items-center space-x-2 shadow-sm"><XCircle className="w-5 h-5" /> <span>Reject</span></button>
                            <button onClick={() => handleAction(vehicle.vehicle_id, 'approve', displayData.license_plate)} className="px-6 py-2.5 bg-[#005B9F] hover:bg-blue-800 text-white font-black rounded-lg shadow-md transition-all flex items-center space-x-2"><CheckCircle className="w-5 h-5" /> <span>Approve</span></button>
                        </div>
                    </div>
                );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      
      {/* SIDEBAR NAVIGATION */}
      <div className="w-[300px] bg-gray-900 text-white flex flex-col shadow-2xl z-20">
        <div className="p-6 border-b border-gray-800 flex items-center">
          <h1 className="text-2xl font-black italic flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
        </div>
        <div className="flex-1 py-6 space-y-2  px-4">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5" /> <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('pending')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pending' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <div className="flex items-center space-x-3"><ClipboardList className="w-5 h-5" /> <span>Vehicle Management</span></div>
            {pendingVehicles.length > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full">{pendingVehicles.length}</span>}
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Users className="w-5 h-5" /> <span>User Management</span>
          </button>
          <button onClick={() => setActiveTab('access-logs')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'access-logs' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <FileText className="w-5 h-5" /> <span>Access Logs</span>
          </button>
          <button onClick={() => setActiveTab('audit-logs')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'audit-logs' ? 'bg-[#FF6B00] text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <History className="w-5 h-5" /> <span>Audit Logs</span>
          </button>
        </div>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }} className="w-full flex items-center justify-center space-x-2 text-sm font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all bg-gray-800 py-3 rounded-xl">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <header className="bg-white h-20 shadow-sm border-b border-gray-200 px-8 flex justify-between items-center z-10">
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Zone Command Center' : activeTab === 'pending' ? 'Pending Approvals' : activeTab === 'users' ? 'User Database' : activeTab === 'access-logs' ? 'Access Logs' : activeTab === 'audit-logs' ? 'Audit Logs' : 'Zone Command Center'}
            </h2>
            <button onClick={() => fetchDashboardData(true)} disabled={isRefreshing} className={`p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 ${isRefreshing ? 'opacity-50' : ''}`} title="Làm mới dữ liệu">
              <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-md border border-blue-100 uppercase tracking-widest hidden sm:inline-block">Khu A</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="p-2 text-gray-400 hover:text-[#005B9F] hover:bg-blue-50 rounded-full relative transition-all">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white font-bold text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">{notifications.length}</span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-gray-50 px-4 py-3 border-b font-black text-gray-700 flex justify-between items-center">
                    Notifications
                    <span className="text-xs text-gray-400 cursor-pointer hover:text-[#005B9F]" onClick={() => setNotifications([])}>Clear All</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notifications.length === 0 ? (
                      <p className="text-center text-gray-400 py-6 text-sm font-medium">No new notifications</p>
                    ) : (
                      notifications.map(n => (
                        <div key={n.id} className="p-3 mb-1 hover:bg-gray-50 rounded-xl transition-colors border-b border-gray-50 last:border-0">
                          <p className="text-sm text-gray-800 font-medium">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1 flex items-center"><Clock className="w-3 h-3 mr-1"/>{n.time}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div onClick={() => navigate('/profile')} className="flex items-center space-x-3 pl-6 border-l border-gray-200 cursor-pointer hover:bg-gray-50 p-2 rounded-2xl transition-all">
                <div className="bg-gray-100 p-1.5 rounded-lg border border-gray-200"><User className="w-5 h-5 text-gray-600" /></div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 text-sm">{localStorage.getItem('full_name') || 'MANAGER'}</span>
                  <span className="text-[10px] text-[#FF6B00] font-bold uppercase tracking-wider">Manager</span>
                </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {loading ? (
             <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>
          ) : (
            <div className="space-y-8">
              {activeTab === 'dashboard' && (
                <>
                  {/* KPI ROW */}
                  <div className="grid grid-cols-4 gap-3">
                    
                    {/* Thẻ 1: Traffic Flow */}
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3 hover:shadow-md transition-shadow min-w-0">
                      <div className="p-2 bg-blue-50 rounded-xl text-[#005B9F] shrink-0">
                        <TrendingUp size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-400 uppercase tracking-wider truncate">Traffic Flow</p>
                        <p className="text-xl font-black text-gray-900 mt-0.5">{kpis?.stats?.total_traffic || 0}</p>
                      </div>
                    </div>

                    {/* Thẻ 2: Automation */}
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3 hover:shadow-md transition-shadow min-w-0">
                      <div className="p-2 bg-orange-50 rounded-xl text-[#FF6B00] shrink-0">
                        <Zap size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-400 uppercase tracking-wider truncate">Automation</p>
                        <p className="text-xl font-black text-gray-900 mt-0.5">{kpis?.stats?.automation_rate_percent || 0}%</p>
                      </div>
                    </div>

                    {/* Thẻ 3: Alerts */}
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3 hover:shadow-md transition-shadow min-w-0">
                      <div className="p-2 bg-red-50 rounded-xl text-red-600 shrink-0">
                        <ShieldAlert size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-400 uppercase tracking-wider truncate">Alerts</p>
                        <p className="text-xl font-black text-red-600 mt-0.5">{kpis?.stats?.security_alerts || 0}</p>
                      </div>
                    </div>

                    {/* Thẻ 4: Vehicles Inside */}
                    <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center space-x-3 hover:shadow-md transition-shadow min-w-0">
                      <div className="p-2 bg-gray-50 rounded-xl text-gray-600 shrink-0">
                        <Users size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-gray-400 uppercase tracking-wider truncate">Inside</p>
                        <p className="text-xl font-black text-gray-900 mt-0.5">{kpis?.stats?.vehicles_inside || 0}</p>
                      </div>
                    </div>

                  </div>
                  {/* CHARTS ROW */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Line Chart */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                      <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3"><Activity className="text-[#005B9F] w-6 h-6"/> 24-Hour Traffic Trend</h3>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trafficChartData}>
                            <defs>
                              <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="100%">
                                <stop offset="5%" stopColor="#005B9F" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#005B9F" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 13, fontWeight: 'bold'}} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 13, fontWeight: 'bold'}} dx={-10} />
                            <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                            <Area type="monotone" dataKey="flow" stroke="#005B9F" strokeWidth={4} fillOpacity={1} fill="url(#colorFlow)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Pie Chart */}
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex flex-col">
                      <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3"><PieIcon className="text-[#FF6B00] w-6 h-6"/> Vehicle Types</h3>
                      <div className="flex-1 min-h-[250px] w-full relative">
                        {pieChartData.length === 0 ? (
                          <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-400 italic">Chưa có dữ liệu xe ra vào</div>
                        ) : (
                          <>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={pieChartData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                                  {pieChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                              </PieChart>
                            </ResponsiveContainer>
                            {/* Chèn tổng số lượng thực tế vào tâm hình tròn */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-3xl font-black text-gray-800">
                                  {pieChartData.reduce((sum, item) => sum + item.value, 0)}
                                </span>
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {/* Chú thích danh mục xe tự động sinh ra theo API */}
                      <div className="space-y-3 mt-6 max-h-[180px] overflow-y-auto pr-1">
                        {pieChartData.map((item) => (
                          <div key={item.name} className="flex justify-between items-center text-sm font-bold bg-gray-50 p-3 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="w-3 h-3 rounded-full" style={{backgroundColor: item.color}}></div> 
                              <span className="text-gray-700">{item.name}</span>
                            </div>
                            <span className="text-gray-900 text-base">{item.value} lượt</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* SYSTEM HEALTH STATUS */}
                  <div className="bg-gray-900 rounded-[32px] p-10 text-white shadow-xl relative overflow-hidden">
                    {/* Decorative glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[#FF6B00] rounded-full blur-[100px] opacity-10 pointer-events-none"></div>
                    
                    <h3 className="text-xl font-black mb-8 flex items-center gap-3 text-[#FF6B00]"><Cpu className="w-6 h-6"/> Real-time System Health</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 relative z-10">
                      <div className="space-y-2 bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">AI Engine</p>
                        <p className="text-green-400 font-bold flex items-center gap-2 text-lg"><Circle className="w-3 h-3 fill-green-400"/> Operational</p>
                      </div>
                      <div className="space-y-2 bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">IoT Gateway</p>
                        <p className="text-green-400 font-bold flex items-center gap-2 text-lg"><Circle className="w-3 h-3 fill-green-400"/> Connected</p>
                      </div>
                      <div className="space-y-2 bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Database</p>
                        <p className="text-green-400 font-bold flex items-center gap-2 text-lg"><Circle className="w-3 h-3 fill-green-400"/> Synced</p>
                      </div>
                      <div className="space-y-2 bg-gray-800/50 p-5 rounded-2xl border border-gray-700">
                        <p className="text-gray-400 text-xs font-black uppercase tracking-widest">Vision Feeds</p>
                        <p className="text-blue-400 font-bold flex items-center gap-2 text-lg"><Globe className="w-5 h-5"/> 4/4 Streams</p>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'pending' && renderPendingSection()}

              {activeTab === 'users' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                      <Shield className="w-6 h-6 text-[#005B9F]" />
                      <h3 className="text-xl font-black text-gray-800">System Users</h3>
                    </div>
                    <button onClick={handleOpenAddUser} className="bg-[#005B9F] hover:bg-blue-800 text-white flex items-center space-x-2 px-4 py-2 rounded-xl font-bold shadow-sm transition-all transform hover:-translate-y-0.5">
                      <UserPlus className="w-5 h-5" /> <span>ADD NEW USER</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-widest text-gray-500">
                          <th className="p-4 font-black">User Info</th>
                          <th className="p-4 font-black">Role</th>
                          <th className="p-4 font-black">Details</th>
                          <th className="p-4 font-black text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {usersList.map((user) => (
                          <tr key={user.user_id} className="hover:bg-blue-50/30 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center space-x-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-white ${user.role === 'manager' ? 'bg-red-500' : user.role === 'guard' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                                  {user.full_name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-gray-900">{user.full_name}</p>
                                  <p className="text-xs text-gray-500 font-mono">@{user.username} {user.email && `• ${user.email}`}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                                user.role === 'manager' ? 'bg-red-100 text-red-700 border border-red-200' : 
                                user.role === 'guard' ? 'bg-orange-100 text-orange-700 border border-orange-200' : 
                                'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                {user.role}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-gray-600">
                              {user.role === 'citizen' && <><span className="font-bold">Tel:</span> {user.phone_number || 'N/A'}<br/><span className="font-bold">Add:</span> {user.address || 'N/A'}<br/><span className="font-bold">CCCD:</span> {user.identity_card_number || 'N/A'}</>}
                              {user.role === 'guard' && <><span className="font-bold">Code:</span> {user.employee_code || 'N/A'}</>}
                              {user.role === 'manager' && <><span className="font-bold">Department:</span> {user.department_name || 'N/A'}</>}
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center space-x-2">
                                <button onClick={() => handleOpenEditUser(user)} className="p-2 text-gray-400 hover:text-[#005B9F] bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors" title="Edit"><Edit className="w-4 h-4" /></button>
                                <button onClick={() => handleDeleteUser(user.user_id, user.username)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {usersList.length === 0 && <tr><td colSpan="4" className="text-center py-10 text-gray-400 font-bold">No users found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ====== TAB: ACCESS LOGS ====== */}
              {activeTab === 'access-logs' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-3 flex-1">
                      <FileText className="w-6 h-6 text-[#005B9F]" />
                      <h3 className="text-xl font-black text-gray-800">Access Logs</h3>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <input
                        type="text"
                        placeholder="Biển số..."
                        value={logFilters.license_plate}
                        onChange={(e) => setLogFilters(p => ({ ...p, license_plate: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={logFilters.start_date}
                        onChange={(e) => setLogFilters(p => ({ ...p, start_date: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none"
                      />
                      <input
                        type="date"
                        value={logFilters.end_date}
                        onChange={(e) => setLogFilters(p => ({ ...p, end_date: e.target.value }))}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={() => fetchAccessLogs(1)}
                        disabled={logLoading}
                        className="px-4 py-2 bg-[#005B9F] text-white font-bold rounded-lg text-sm hover:bg-blue-800 transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Search className="w-4 h-4" /> Tìm kiếm
                      </button>
                    </div>
                  </div>
                  {logLoading ? (
                    <div className="flex justify-center py-16">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#005B9F]"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-widest text-gray-500">
                            <th className="p-4 font-black">Thời gian</th>
                            <th className="p-4 font-black">Làn / Cổng</th>
                            <th className="p-4 font-black">Biển số</th>
                            <th className="p-4 font-black">Phương thức</th>
                            <th className="p-4 font-black">Lý do</th>
                            <th className="p-4 font-black">Bảo vệ</th>
                            <th className="p-4 font-black">Ghi chú</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {accessLogs.length === 0 ? (
                            <tr>
                              <td colSpan="7" className="text-center py-16 text-gray-400 font-bold italic">
                                Không có dữ liệu log.
                              </td>
                            </tr>
                          ) : (
                            accessLogs.map((log) => (
                              <tr key={log.log_id} className="hover:bg-blue-50/30 transition-colors">
                                <td className="p-4 text-sm font-bold text-gray-700 whitespace-nowrap">
                                  {new Date(log.check_in_time).toLocaleString('en-GB')}
                                </td>
                                <td className="p-4">
                                  <div className="text-sm font-bold text-gray-900">{log.lane_name || '—'}</div>
                                  <div className="text-xs text-gray-400">{log.gate_name || '—'}</div>
                                </td>
                                <td className="p-4 font-black text-gray-900 tracking-widest text-sm">
                                  {log.license_plate || log.detected_text || <span className="text-gray-400 font-normal italic">N/A</span>}
                                </td>
                                <td className="p-4">
                                  <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-bold">
                                    {log.access_method || '—'}
                                  </span>
                                </td>
                                <td className="p-4 text-sm text-gray-600">
                                  {log.action_reason || <span className="text-gray-300">—</span>}
                                </td>
                                <td className="p-4 text-sm font-bold text-gray-700">
                                  {log.guard_name || <span className="text-gray-400 italic font-normal">AI</span>}
                                </td>
                                <td className="p-4 text-sm text-gray-600 max-w-[150px] truncate" title={log.note}>
                                  {log.note || <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500 font-bold">
                    <span>Tổng: {logPagination.total} bản ghi</span>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={logPagination.page <= 1 || logLoading}
                        onClick={() => fetchAccessLogs(logPagination.page - 1)}
                        className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >← Trước</button>
                      <span>Trang {logPagination.page} / {logPagination.total_pages || 1}</span>
                      <button
                        disabled={logPagination.page >= (logPagination.total_pages || 1) || logLoading}
                        onClick={() => fetchAccessLogs(logPagination.page + 1)}
                        className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
                      >Sau →</button>
                    </div>
                  </div>
                </div>
              )}

              {/* ====== TAB: AUDIT LOGS ====== */}
              {activeTab === 'audit-logs' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <History className="w-6 h-6 text-[#FF6B00]" />
                      <h3 className="text-xl font-black text-gray-800">System Audit Logs</h3>
                    </div>
                    <button
                      onClick={() => fetchAuditLogs(1)}
                      disabled={auditLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors text-sm disabled:opacity-50"
                    >
                      <RotateCw className={`w-4 h-4 ${auditLoading ? 'animate-spin' : ''}`} /> Làm mới
                    </button>
                  </div>
                  {auditLoading ? (
                    <div className="flex justify-center py-16">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#FF6B00]"></div>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-widest text-gray-500">
                            <th className="p-4 font-black">Thời gian</th>
                            <th className="p-4 font-black">Loại hành động</th>
                            <th className="p-4 font-black">Bảng / Đối tượng</th>
                            <th className="p-4 font-black">Người thực hiện</th>
                            <th className="p-4 font-black">Chi tiết</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {auditLogs.length === 0 ? (
                            <tr>
                              <td colSpan="5" className="text-center py-16 text-gray-400 font-bold italic">
                                Chưa có audit log nào.
                              </td>
                            </tr>
                          ) : (
                            auditLogs.map((log) => (
                              <tr key={log.audit_id} className="hover:bg-orange-50/20 transition-colors">
                                <td className="p-4 text-sm font-bold text-gray-700 whitespace-nowrap">
                                  {new Date(log.performed_at).toLocaleString('en-GB')}
                                </td>
                                <td className="p-4">
                                  <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-bold uppercase">
                                    {log.action_type || '—'}
                                  </span>
                                </td>
                                <td className="p-4 text-sm font-bold text-gray-800">
                                  <div>{log.target_table || '—'}</div>
                                  <div className="text-xs text-gray-400 font-mono">ID: {log.target_id || '—'}</div>
                                </td>
                                <td className="p-4">
                                  <div className="text-sm font-bold text-gray-900">{log.actor_name || '—'}</div>
                                  <div className="text-xs text-gray-400 uppercase">{log.actor_role || '—'}</div>
                                </td>
                                <td className="p-4 text-sm text-gray-600 max-w-[220px] truncate" title={
                                  log.action_details
                                    ? (typeof log.action_details === 'object'
                                        ? JSON.stringify(log.action_details)
                                        : String(log.action_details))
                                    : ''
                                }>
                                  {log.action_details
                                    ? (typeof log.action_details === 'object'
                                        ? JSON.stringify(log.action_details).substring(0, 80)
                                        : String(log.action_details).substring(0, 80))
                                    : <span className="text-gray-300">—</span>}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-400 font-bold">
                    Tổng: {auditLogs.length} bản ghi
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
      {/* MODAL ADD/EDIT USER */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl">
            <div className="bg-[#005B9F] p-5 flex justify-between items-center text-white">
              <h3 className="text-xl font-black flex items-center gap-2"><UserPlus className="w-5 h-5"/> {editingUser ? 'EDIT USER PROFILE' : 'CREATE NEW USER'}</h3>
              <button onClick={() => setIsUserModalOpen(false)} className="hover:bg-blue-800 p-1.5 rounded-full"><XCircle className="w-6 h-6" /></button>
            </div>
            
            <form onSubmit={handleUserSubmit} className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Username</label>
                  <input type="text" required value={userFormData.username} onChange={(e) => setUserFormData({...userFormData, username: e.target.value})} className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 font-bold text-gray-800" placeholder="e.g. nguyen_a" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Password {editingUser && <span className="text-gray-400 lowercase font-normal">(Leave blank to keep current)</span>}</label>
                  <input type={editingUser ? "password" : "text"} required={!editingUser} value={userFormData.password} onChange={(e) => setUserFormData({...userFormData, password: e.target.value})} className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 font-bold" placeholder={editingUser ? "••••••••" : "Min 6 characters"} />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Full Name</label>
                  <input type="text" required value={userFormData.full_name} onChange={(e) => setUserFormData({...userFormData, full_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 font-bold" placeholder="e.g. Nguyen Van A" />
                </div>
                <div>
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Email</label>
                  <input type="email" value={userFormData.email} onChange={(e) => setUserFormData({...userFormData, email: e.target.value})} className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 font-bold" placeholder="Optional" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-1">Role</label>
                  <select disabled={!!editingUser} value={userFormData.role} onChange={(e) => setUserFormData({...userFormData, role: e.target.value})} className="w-full px-4 py-3 rounded-xl border bg-gray-50 focus:bg-white focus:border-blue-500 font-bold uppercase disabled:opacity-50">
                    <option value="citizen">Citizen</option>
                    <option value="guard">Guard</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>

                {/* DYNAMIC FIELDS BASED ON ROLE */}
                <div className="md:col-span-2 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-5">
                  {userFormData.role === 'citizen' && (
                    <>
                      <div>
                        <label className="block text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Phone Number</label>
                        <input type="text" value={userFormData.phone_number} onChange={(e) => setUserFormData({...userFormData, phone_number: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 focus:bg-white focus:border-blue-500 font-bold" />
                      </div>
                      <div>
                        <label className="block text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Address / Apartment</label>
                        <input type="text" value={userFormData.address} onChange={(e) => setUserFormData({...userFormData, address: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 focus:bg-white focus:border-blue-500 font-bold" placeholder="A-101" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-black text-blue-500 uppercase tracking-widest mb-1">Identity Card Number (CCCD)</label>
                        <input type="text" value={userFormData.identity_card_number} onChange={(e) => setUserFormData({...userFormData, identity_card_number: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-blue-50 focus:bg-white focus:border-blue-500 font-bold tracking-widest" placeholder="VD: 07920300..." />
                      </div>
                    </>
                  )}
                  {userFormData.role === 'guard' && (
                    <div>
                      <label className="block text-xs font-black text-orange-500 uppercase tracking-widest mb-1">Employee Code</label>
                      <input type="text" value={userFormData.employee_code} onChange={(e) => setUserFormData({...userFormData, employee_code: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-orange-100 bg-orange-50 focus:bg-white focus:border-orange-500 font-bold uppercase" placeholder="G-123" />
                    </div>
                  )}
                  {userFormData.role === 'manager' && (
                    <div>
                      <label className="block text-xs font-black text-red-500 uppercase tracking-widest mb-1">Department</label>
                      <input type="text" value={userFormData.department_name} onChange={(e) => setUserFormData({...userFormData, department_name: e.target.value})} className="w-full px-4 py-3 rounded-xl border border-red-100 bg-red-50 focus:bg-white focus:border-red-500 font-bold" placeholder="Ban Quản Lý" />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsUserModalOpen(false)} className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-[#005B9F] text-white font-black rounded-xl shadow-md hover:bg-blue-800 transition-colors">{editingUser ? 'UPDATE USER' : 'CREATE USER'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;