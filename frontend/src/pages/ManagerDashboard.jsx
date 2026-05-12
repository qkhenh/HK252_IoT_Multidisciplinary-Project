import React, { useState, useEffect, useRef } from 'react';

import { 
  Zap, LogOut, User, Activity, Car, ShieldAlert, Users, 
  CheckCircle, XCircle, Clock, RotateCw, Bell, LayoutDashboard, 
  ClipboardList, TrendingUp, PieChart as PieIcon, Cpu, Globe, Circle 
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
  const isFirstLoad = useRef(true);
  const prevPendingRef = useRef([]);

  const trafficData = [
    { time: '00:00', flow: 10 }, { time: '04:00', flow: 5 }, { time: '08:00', flow: 120 },
    { time: '12:00', flow: 80 }, { time: '16:00', flow: 150 }, { time: '20:00', flow: 60 },
    { time: '23:59', flow: 20 },
  ];

  const vehicleTypeData = [
    { name: 'Car', value: 65, color: '#005B9F' },
    { name: 'Motorbike', value: 30, color: '#FF6B00' },
    { name: 'Truck', value: 5, color: '#64748b' },
  ];

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
      const [kpiRes, pendingRes] = await Promise.all([
        fetch('http://localhost:5000/api/v1/managers/analytics/overview', { headers }),
        fetch('http://localhost:5000/api/v1/managers/vehicles/pending', { headers })
      ]);

      if (kpiRes.status === 403) { alert("LỖI QUYỀN TRUY CẬP!"); navigate('/'); return; }

      if (pendingRes.ok) {
        const pData = await pendingRes.json();
        const newPending = Array.isArray(pData) ? pData : (pData.data?.vehicles || pData.data || []);
        
        if (!isFirstLoad.current) {
            newPending.forEach(nv => {
                const oldV = prevPendingRef.current.find(v => v.vehicle_id === nv.vehicle_id);
                // THÔNG BÁO CHO MANAGER KHI CÓ ĐƠN MỚI
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
      
      if (kpiRes.ok) {
        const kData = await kpiRes.json();
        setKpis(kData?.data || kData || {});
      }
    } catch (error) { 
      console.error("Lỗi API:", error); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false); 
    }
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
              {activeTab === 'dashboard' ? 'Zone Command Center' : activeTab === 'pending' ? 'Pending Approvals' : 'User Database'}
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
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-md transition-shadow">
                      <div className="p-5 bg-blue-50 rounded-2xl text-[#005B9F]"><TrendingUp size={36} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Traffic Flow</p><p className="text-4xl font-black text-gray-900">{kpis?.stats?.total_traffic || 320}</p></div>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-md transition-shadow">
                      <div className="p-5 bg-orange-50 rounded-2xl text-[#FF6B00]"><Zap size={36} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Automation</p><p className="text-4xl font-black text-gray-900">{kpis?.stats?.automation_rate || 87}%</p></div>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-md transition-shadow">
                      <div className="p-5 bg-red-50 rounded-2xl text-red-600"><ShieldAlert size={36} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Alerts</p><p className="text-4xl font-black text-red-600">{kpis?.stats?.security_alerts || 12}</p></div>
                    </div>
                    <div className="bg-white p-8 rounded-[32px] shadow-sm border border-gray-100 flex items-center space-x-6 hover:shadow-md transition-shadow">
                      <div className="p-5 bg-gray-50 rounded-2xl text-gray-600"><Users size={36} /></div>
                      <div><p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Active Guests</p><p className="text-4xl font-black text-gray-900">{kpis?.stats?.active_visitors || 15}</p></div>
                    </div>
                  </div>

                  {/* CHARTS ROW */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Line Chart */}
                    <div className="lg:col-span-2 bg-white p-8 rounded-[32px] shadow-sm border border-gray-100">
                      <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3"><Activity className="text-[#005B9F] w-6 h-6"/> 24-Hour Traffic Trend</h3>
                      <div className="h-[350px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trafficData}>
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
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={vehicleTypeData} innerRadius={70} outerRadius={100} paddingAngle={8} dataKey="value">
                              {vehicleTypeData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'}} />
                          </PieChart>
                        </ResponsiveContainer>
                        {/* Center text for donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-gray-800">100</span>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Total</span>
                        </div>
                      </div>
                      <div className="space-y-4 mt-8">
                        {vehicleTypeData.map((item) => (
                          <div key={item.name} className="flex justify-between items-center text-sm font-bold bg-gray-50 p-3 rounded-xl">
                            <div className="flex items-center gap-3"><div className="w-4 h-4 rounded-full" style={{backgroundColor: item.color}}></div> <span className="text-gray-700">{item.name}</span></div>
                            <span className="text-gray-900 text-base">{item.value}%</span>
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