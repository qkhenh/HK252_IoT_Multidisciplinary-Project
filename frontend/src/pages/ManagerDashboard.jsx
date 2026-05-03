import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, LogOut, User, Activity, Car, ShieldAlert, Users, 
  CheckCircle, XCircle, Clock, RotateCw, Bell, LayoutDashboard, ClipboardList 
} from 'lucide-react';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard'); // Tabs: dashboard, pending, users
  
  const [kpis, setKpis] = useState({});
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // HỆ THỐNG THÔNG BÁO (NOTIFICATION)
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  const addNotification = (message, type = 'info') => {
    setNotifications(prev => [{ 
      id: Date.now(), 
      message, 
      type, 
      time: new Date().toLocaleTimeString('vi-VN') 
    }, ...prev]);
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true); else setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      const [kpiRes, pendingRes] = await Promise.all([
        fetch('http://localhost:5000/api/v1/managers/analytics/overview', { headers }),
        fetch('http://localhost:5000/api/v1/managers/vehicles/pending', { headers })
      ]);

      if (kpiRes.status === 403) { alert("LỖI QUYỀN TRUY CẬP!"); navigate('/'); return; }

      if (pendingRes.ok) {
        const pData = await pendingRes.json();
        const safeArray = Array.isArray(pData) ? pData : (pData.data?.vehicles || pData.data || []);
        setPendingVehicles(safeArray);
      }
      if (kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpis(kData?.data || kData || {});
      }
    } catch (error) { console.error("Lỗi API:", error); } 
    finally { setLoading(false); setIsRefreshing(false); }
  };

  const handleAction = async (vehicleId, actionType, licensePlate) => {
    const isApprove = actionType === 'approve';
    if (!window.confirm(`Xác nhận ${isApprove ? 'DUYỆT' : 'TỪ CHỐI'} xe ${licensePlate}?`)) return;

    try {
      const response = await fetch(`http://localhost:5000/api/v1/managers/vehicles/${vehicleId}/${actionType}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(isApprove ? {} : { reason: "Không đạt yêu cầu" })
      });

      if (response.ok) {
        setPendingVehicles(prev => prev.filter(v => v.vehicle_id !== vehicleId));
        addNotification(`Đã ${isApprove ? 'duyệt' : 'từ chối'} xe ${licensePlate} thành công!`, "success");
      }
    } catch (error) { alert("Lỗi kết nối!"); }
  };

  // Hàm render khung danh sách xe chờ duyệt    
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
                    <div key={displayData.vehicle_id || Math.random()} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors gap-6">
                        <div className="flex items-start space-x-5 flex-1">
                            <div className="bg-blue-100 text-blue-800 p-3 rounded-xl font-black text-2xl tracking-widest border-2 border-blue-200 shrink-0 min-w-[160px] text-center">
                                {displayData.license_plate}
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center space-x-2 mb-1">
                                    {vehicle.status === 'pending_new' && <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-blue-200 uppercase tracking-wider">✨ New Registration</span>}
                                    {vehicle.status === 'pending_update' && <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-200 uppercase tracking-wider">🔄 Info Update</span>}
                                    {vehicle.status === 'pending_delete' && <span className="bg-red-100 text-red-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-red-200 uppercase tracking-wider">🗑️ Delete Request</span>}
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
                            <button onClick={() => handleAction(vehicle.vehicle_id, 'approve', displayData.license_plate)} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg shadow-md transition-all flex items-center space-x-2"><CheckCircle className="w-5 h-5" /> <span>Approve</span></button>
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
      <div className="w-[300px] bg-gray-900 text-white flex flex-col shadow-3xl z-20">
        <div className="p-6 border-b border-gray-800 flex items-center">
          <h1 className="text-2xl font-black italic flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-blue-500 ml-1" fill="#3B82F6" />
          </h1>
        </div>
        <div className="flex-1 py-6 space-y-2  px-4">
          <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <LayoutDashboard className="w-5 h-5" /> <span>Dashboard</span>
          </button>
          <button onClick={() => setActiveTab('pending')} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'pending' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <div className="flex items-center space-x-3"><ClipboardList className="w-5 h-5" /> <span>Vehicle Management</span></div>
            {pendingVehicles.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1 py-0.5 rounded-full">{pendingVehicles.length}</span>}
          </button>
          <button onClick={() => setActiveTab('users')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-bold transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}>
            <Users className="w-5 h-5" /> <span>User Management</span>
          </button>
        </div>
        <div className="p-4 border-t border-gray-800">
          <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }} className="w-full flex items-center justify-center space-x-2 text-sm font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all bg-gray-800 py-3 rounded-xl">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* TOP HEADER */}
        <header className="bg-white h-20 shadow-sm border-b border-gray-200 px-8 flex justify-between items-center z-10">
          {/* Nhóm tiêu đề và nút Refresh */}
          <div className="flex items-center space-x-4">
            <h2 className="text-xl font-black text-gray-800 tracking-tight uppercase">
              {activeTab === 'dashboard' ? 'Zone Command Center' : activeTab === 'pending' ? 'Pending Approvals' : 'User Database'}
            </h2>
            
            {/* Nút Refresh xuất hiện ở tất cả các tab để Manager chủ động cập nhật dữ liệu */}
            <button 
              onClick={() => fetchDashboardData(true)} 
              disabled={isRefreshing} 
              className={`p-2 hover:bg-gray-100 rounded-full transition-all text-gray-500 ${isRefreshing ? 'opacity-50' : ''}`}
              title="Làm mới dữ liệu"
            >
              <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
            
            <span className="px-3 py-1 bg-blue-50 text-blue-600 font-bold text-[10px] rounded-md border border-blue-100 uppercase tracking-widest hidden sm:inline-block">
              Khu A
            </span>
          </div>
          <div className="flex items-center space-x-6">
            {/* ICON NOTIFICATION[cite: 19] */}
            <div className="relative">
              <button onClick={() => setShowNotif(!showNotif)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full relative transition-all">
                <Bell className="w-6 h-6" />
                {notifications.length > 0 && <span className="absolute top-0 right-0 bg-red-500 w-2 h-2 rounded-full border border-white"></span>}
              </button>
              {showNotif && (
                <div className="absolute right-0 mt-3 w-80 bg-white border border-gray-100 shadow-2xl rounded-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-4">
                  <div className="bg-gray-50 px-4 py-3 border-b font-black text-gray-700 flex justify-between items-center">
                    Notifications
                    <span className="text-xs text-gray-400 cursor-pointer hover:text-blue-600" onClick={() => setNotifications([])}>Clear All</span>
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
            <div className="flex items-center space-x-3 pl-6 border-l border-gray-200">
                <div className="bg-gray-100 p-1.5 rounded-lg border border-gray-200"><User className="w-5 h-5 text-gray-600" /></div>
                <div className="flex flex-col">
                  <span className="font-bold text-gray-800 text-sm">THINH</span>
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Manager</span>
                </div>
              </div>
            </div>
        </header>

        {/* SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-8 bg-gray-50">
          {loading ? (
             <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>
          ) : (
            <div className="space-y-8">
              {/* PHẦN DASHBOARD (KPI CARDS)[cite: 20] */}
              {activeTab === 'dashboard' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                      <div className="p-4 bg-blue-50 rounded-xl text-blue-600"><Car size={32} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Traffic Today</p><p className="text-2xl font-black">{kpis?.total_traffic_today || 0}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                      <div className="p-4 bg-green-50 rounded-xl text-green-600"><Activity size={32} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Automation</p><p className="text-2xl font-black">{kpis?.automation_rate_percent || 0}%</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                      <div className="p-4 bg-purple-50 rounded-xl text-purple-600"><Users size={32} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Visitors</p><p className="text-2xl font-black">{kpis?.active_visitors_now || 0}</p></div>
                    </div>
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                      <div className="p-4 bg-red-50 rounded-xl text-red-600"><ShieldAlert size={32} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase">Alerts</p><p className="text-2xl font-black text-red-600">{kpis?.security_alerts_today || 0}</p></div>
                    </div>
                  </div>
                </>
              )}

              {/* PHẦN PENDING TAB RIÊNG */}
              {activeTab === 'pending' && renderPendingSection()}

              {/* PHẦN USER MANAGEMENT */}
              {activeTab === 'users' && (
                <div className="bg-white rounded-2xl p-20 text-center border-2 border-dashed border-gray-200">
                  <Users size={48} className="mx-auto text-gray-300 mb-4" />
                  <h3 className="text-xl font-bold text-gray-400">User Management module is under development...</h3>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ManagerDashboard;