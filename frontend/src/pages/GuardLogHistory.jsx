import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogOut, User, RotateCw } from 'lucide-react';

const ACCESS_METHOD_LABELS = {
  ai_plate_recognition: 'AI Camera',
  ai_camera_otp: 'AI OTP',
  ai_camera_qr: 'AI QR',
  manual_guard: 'Manual Guard',
  otp_manual: 'OTP Manual',
};

const GuardLogHistory = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [laneId, setLaneId] = useState('MAIN-IN');
  const [limit, setLimit] = useState(50);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `http://localhost:5000/api/v1/guards/logs?lane_id=${encodeURIComponent(laneId)}&limit=${limit}`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
      }
    } catch (e) {
      console.error('Lỗi fetch logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [laneId, limit]);

  const formatTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return `${d.toLocaleDateString('en-GB')} ${d.toLocaleTimeString('en-GB')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans flex flex-col">

      {/* NAVBAR — cùng style với GuardDashboard */}
      <div className="bg-[#005B9F] flex items-center justify-between px-6 py-3 shadow-md w-full border-b-4 border-[#FF6B00] shrink-0">
        <div className="flex items-center space-x-6 flex-shrink-0">
          <h1 className="text-2xl font-black italic text-white flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-1.5 hover:bg-blue-800 rounded-full transition-colors"
            title="Làm mới"
          >
            <RotateCw className={`w-5 h-5 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 text-sm font-bold text-[#005B9F] hover:bg-gray-200 transition-colors bg-white px-3 py-1.5 rounded-md shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>LOG OUT</span>
          </button>
        </div>

        <div className="flex items-center space-x-16 font-bold text-white flex-1 justify-center text-sm tracking-wider">
          <span
            className="cursor-pointer hover:text-[#FF6B00] transition-colors"
            onClick={() => navigate('/guard-dashboard')}
          >
            DASHBOARD
          </span>
          <span
            className="cursor-pointer hover:text-[#FF6B00] transition-colors"
            onClick={() => navigate('/manual-mode')}
          >
            MANUAL MODE
          </span>
          <span className="cursor-pointer border-b-2 border-white pb-1">LOG HISTORY</span>
        </div>

        <div
          onClick={() => navigate('/profile')}
          className="flex items-center space-x-2 font-bold text-white flex-shrink-0 bg-blue-800 px-3 py-1.5 rounded-md border border-blue-700 text-sm cursor-pointer hover:bg-blue-700"
        >
          <User className="w-5 h-5" />
          <span>{localStorage.getItem('full_name') || 'GUARD'}</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-6 max-w-[1400px] mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">

          {/* Header + Bộ lọc */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-wrap items-center gap-4">
            <h3 className="text-xl font-black text-gray-800 flex-1">Access Log History</h3>
            <div className="flex items-center gap-3">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Làn</label>
              <select
                value={laneId}
                onChange={(e) => setLaneId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
              >
                <option value="MAIN-IN">MAIN-IN (Vào)</option>
                <option value="MAIN-OUT">MAIN-OUT (Ra)</option>
                <option value="B-IN">B-IN</option>
                <option value="B-OUT">B-OUT</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Hiển thị</label>
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="px-3 py-2 rounded-lg border border-gray-200 bg-white font-bold text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
              >
                <option value={20}>20 bản ghi</option>
                <option value={50}>50 bản ghi</option>
                <option value={100}>100 bản ghi</option>
              </select>
            </div>
          </div>

          {/* Danh sách Log */}
          {loading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#005B9F]"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-xs uppercase tracking-widest text-gray-500">
                    <th className="p-4 font-black">#</th>
                    <th className="p-4 font-black">Thời gian</th>
                    <th className="p-4 font-black">Làn</th>
                    <th className="p-4 font-black">Biển số / Nhận dạng</th>
                    <th className="p-4 font-black">Phương thức</th>
                    <th className="p-4 font-black">Lý do</th>
                    <th className="p-4 font-black">Ghi chú</th>
                    <th className="p-4 font-black">Bảo vệ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="text-center py-16 text-gray-400 font-bold italic">
                        Chưa có dữ liệu log cho làn này.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, idx) => (
                      <tr key={log.log_id} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-4 text-xs text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-4 text-sm font-bold text-gray-700 whitespace-nowrap">
                          {formatTime(log.check_in_time)}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                            (log.lane_name || log.lane_id || '').includes('OUT')
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {log.lane_name || log.lane_id || '—'}
                          </span>
                        </td>
                        <td className="p-4 font-black text-gray-900 tracking-widest text-sm">
                          {log.license_plate || log.detected_text || (
                            <span className="text-gray-400 font-normal italic">Không xác định</span>
                          )}
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-bold">
                            {ACCESS_METHOD_LABELS[log.access_method] || log.access_method || '—'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {log.action_reason || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate" title={log.note}>
                          {log.note || <span className="text-gray-300">—</span>}
                        </td>
                        <td className="p-4 text-sm font-bold text-gray-700">
                          {log.guard_name || <span className="text-gray-400 font-normal italic">AI</span>}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="px-6 py-3 border-t border-gray-100 text-sm text-gray-400 font-bold">
            Tổng: {logs.length} bản ghi
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuardLogHistory;
