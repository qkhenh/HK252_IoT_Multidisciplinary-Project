import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, LogOut, User, Activity, Car, ShieldAlert, Users, 
  CheckCircle, XCircle, Clock, FileText, RotateCw
} from 'lucide-react';

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState({});
  const [pendingVehicles, setPendingVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setLoading(true);

    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` };
      
      const [kpiRes, pendingRes] = await Promise.all([
        fetch('http://localhost:5000/api/v1/managers/analytics/overview', { headers }),
        fetch('http://localhost:5000/api/v1/managers/vehicles/pending', { headers })
      ]);

      if (kpiRes.status === 403 || pendingRes.status === 403) {
        alert("🛑 LỖI QUYỀN TRUY CẬP: Bạn đang dùng tài khoản Cư dân (Citizen) để vào trang của Quản lý (Manager). Hãy nhấn Đăng xuất và đăng nhập lại bằng tài khoản 'manager_thinh' nhé!");
        navigate('/');
        return;
      }

      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        let safeArray = [];
        if (Array.isArray(pendingData)) safeArray = pendingData;
        else if (pendingData?.data && Array.isArray(pendingData.data)) safeArray = pendingData.data;
        else if (pendingData?.data?.vehicles && Array.isArray(pendingData.data.vehicles)) safeArray = pendingData.data.vehicles;
        setPendingVehicles(safeArray);
      } else {
        console.error("Lỗi lấy xe chờ duyệt:", pendingRes.status);
      }

      if (kpiRes.ok) {
        const kpiData = await kpiRes.json();
        setKpis(kpiData?.data || kpiData || {});
      } else {
        console.error("Lỗi lấy KPI:", kpiRes.status);
      }

    if (isRefresh) await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      console.error("Lỗi gọi API:", error);
      alert("⚠️ Không thể kết nối đến Backend. Hãy kiểm tra xem server NodeJS đã chạy chưa nhé!");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    fetchDashboardData(true);
  };

  const handleAction = async (vehicleId, actionType) => {
    const isApproved = actionType === 'approve';
    const confirmMsg = isApproved ? "Xác nhận DUYỆT xe này?" : "Xác nhận TỪ CHỐI xe này?";
    
    if (!window.confirm(confirmMsg)) return;

    try {
      const bodyData = isApproved ? {} : { reason: "Biển số hoặc thông tin không hợp lệ." };
      const response = await fetch(`http://localhost:5000/api/v1/managers/vehicles/${vehicleId}/${actionType}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(bodyData)
      });

      if (response.ok) {
        setPendingVehicles(prev => (Array.isArray(prev) ? prev.filter(v => v.vehicle_id !== vehicleId) : []));
        alert(isApproved ? '✅ Đã duyệt xe thành công!' : '❌ Đã từ chối xe.');
      } else {
        const errData = await response.json();
        alert(`Lỗi: ${errData.message || 'Hệ thống từ chối thao tác'}`);
      }
    } catch (error) {
      alert("Lỗi kết nối khi gửi yêu cầu.");
    }
  };

  const pendingCount = Array.isArray(pendingVehicles) ? pendingVehicles.length : 0;

  return (
    <div className="min-h-screen bg-gray-100 font-sans flex flex-col w-full">
      <div className="bg-gray-900 flex items-center justify-between px-6 py-4 shadow-xl w-full border-b-4 border-blue-500 sticky top-0 z-40">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-black italic text-white flex items-center tracking-tighter m-0">
              BKEzPass <Zap size={24} className="text-blue-500 ml-1" fill="#3B82F6" />
            </h1>
            <span className="ml-4 px-3 py-1 bg-blue-500/20 text-blue-400 font-bold text-xs rounded-full border border-blue-500/30 uppercase tracking-widest hidden sm:inline-block">
              Manager Portal
            </span>
          </div>
          <button 
            onClick={handleRefresh}
            className={`p-2 hover:bg-gray-800 rounded-full transition-all duration-300 border border-gray-700 ml-2 ${isRefreshing ? 'opacity-50 cursor-not-allowed bg-gray-800' : ''}`}
            disabled={isRefreshing}
            title="Refresh Data"
          >
            <RotateCw className={`w-5 h-5 text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <div className="flex items-center space-x-6 text-white font-bold">
          <div className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-700">
            <User className="w-5 h-5 text-gray-400" /> 
            <span className="tracking-wide">MANAGER_THINH</span>
          </div>
          <button onClick={() => {
            localStorage.removeItem('token');
            navigate('/');
          }} className="flex items-center space-x-2 text-sm font-bold text-red-500 hover:text-red-400 transition-colors">
            <LogOut className="w-5 h-5" /> <span>LOG OUT</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-8 w-full max-w-7xl mx-auto space-y-8">
        <div>
          <h2 className="text-3xl font-black text-gray-800 tracking-tight">Zone Command Center</h2>
          <p className="text-gray-500 font-medium mt-1">Real-time overview and administrative controls for Khu A.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div></div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                <div className="p-4 bg-blue-50 rounded-xl text-blue-600"><Car className="w-8 h-8" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase">Traffic Today</p>
                  <p className="text-3xl font-black text-gray-800">{kpis?.total_traffic_today || 0}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                <div className="p-4 bg-green-50 rounded-xl text-green-600"><Activity className="w-8 h-8" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase">Automation</p>
                  <p className="text-3xl font-black text-gray-800">{kpis?.automation_rate_percent || 0}%</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                <div className="p-4 bg-purple-50 rounded-xl text-purple-600"><Users className="w-8 h-8" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase">Active Visitors</p>
                  <p className="text-3xl font-black text-gray-800">{kpis?.active_visitors_now || 0}</p>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex items-center space-x-4">
                <div className="p-4 bg-red-50 rounded-xl text-red-600"><ShieldAlert className="w-8 h-8" /></div>
                <div>
                  <p className="text-sm font-bold text-gray-400 uppercase">Security Alerts</p>
                  <p className="text-3xl font-black text-red-600">{kpis?.security_alerts_today || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <Clock className="w-6 h-6 text-[#FF6B00]" />
                  <h3 className="text-xl font-black text-gray-800">Pending Vehicle Approvals</h3>
                </div>
                <span className="bg-[#FF6B00] text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                  {pendingCount} Requests
                </span>
              </div>

              <div className="p-0">
                {pendingCount === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-200" />
                    <p className="text-xl font-bold">All caught up!</p>
                    <p>No pending vehicles waiting for approval.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {Array.isArray(pendingVehicles) && pendingVehicles.map((vehicle) => {
                        const isNewRegistration = !vehicle.last_log_time || (vehicle.last_log_time === vehicle.registered_at);

                        return (
                            <div key={vehicle.vehicle_id || Math.random()} className="p-6 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors gap-6">
                                
                                <div className="flex items-start space-x-5 flex-1">
                                    <div className="bg-blue-100 text-blue-800 p-3 rounded-xl font-black text-2xl tracking-widest border-2 border-blue-200 shrink-0 min-w-[160px] text-center">
                                        {vehicle.license_plate || 'UNKNOWN'}
                                    </div>

                                    <div className="space-y-1">
                                        {/* PHÂN LOẠI NHÃN HIỂN THỊ */}
                                        <div className="flex items-center space-x-2 mb-1">
                                            {isNewRegistration ? (
                                                <span className="bg-blue-100 text-blue-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-blue-200 uppercase tracking-wider">
                                                    ✨ New Registration
                                                </span>
                                            ) : (
                                                <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-md font-bold border border-amber-200 uppercase tracking-wider">
                                                    🔄 Information Update
                                                </span>
                                            )}
                                        </div>

                                        {/* HIỂN THỊ THÔNG TIN CHI TIẾT */}
                                        <p className="text-lg font-black text-gray-800">
                                            <span className="text-gray-400 font-bold">Vehicle Type:</span> <span className="capitalize">{vehicle.vehicle_type || 'N/A'}</span>
                                            <span className="mx-3 text-gray-300">|</span>
                                            <span className="text-gray-400 font-bold">Color:</span> <span className="capitalize">{vehicle.vehicle_color || 'N/A'}</span>
                                        </p>

                                        <div className="flex items-center space-x-2 text-sm font-medium text-gray-600">
                                            <User className="w-4 h-4 text-gray-400" /> 
                                            <span className="font-bold text-gray-700">{vehicle.owner_name || vehicle.owner?.full_name || 'Lê Thị Cư Dân'}</span>
                                            <span className="text-gray-300 mx-1">•</span>
                                            <span className="text-gray-500">{vehicle.owner_address || vehicle.owner?.house_number || 'Tòa A, Tầng 1, Căn 101, Khu A'}</span>
                                        </div>

                                        <p className="text-[11px] text-gray-400 flex items-center pt-1">
                                            <Clock className="w-3 h-3 mr-1"/> 
                                            Request sent: {vehicle.registered_at ? new Date(vehicle.registered_at).toLocaleString('vi-VN') : 'Unknown Date'}
                                        </p>
                                    </div>
                                </div>

                                {/* NÚT HÀNH ĐỘNG GIỮ NGUYÊN */}
                                <div className="flex space-x-3 shrink-0">
                                    <button 
                                        onClick={() => handleAction(vehicle.vehicle_id, 'reject')}
                                        className="px-5 py-2.5 bg-white text-red-600 hover:bg-red-50 font-bold rounded-lg border border-red-200 transition-all flex items-center space-x-2 shadow-sm"
                                    >
                                        <XCircle className="w-5 h-5" /> <span>Reject</span>
                                    </button>
                                    <button 
                                        onClick={() => handleAction(vehicle.vehicle_id, 'approve')}
                                        className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-black rounded-lg shadow-md hover:translate-y-[-2px] active:translate-y-[0px] transition-all flex items-center space-x-2"
                                    >
                                        <CheckCircle className="w-5 h-5" /> <span>Approve</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                  </div>
                )}
              </div>
            </div>

          </>
        )}
      </div>
    </div>
  );
};

export default ManagerDashboard;