import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, LogOut, User, Zap, ArrowRightToLine, ArrowLeftFromLine } from 'lucide-react';
import { io } from 'socket.io-client';

const GuardDashboard = () => {
  const navigate = useNavigate();
  
  // 1. STATES BẢNG THÔNG BÁO (ĐÃ CHIA LÀM 2 BIẾN ĐỘC LẬP)
  const [inData, setInData] = useState({ result: null, plate: '', owner: '', type: '', access: '' });
  const [outData, setOutData] = useState({ result: null, plate: '', owner: '', type: '', access: '' });

  // 2. STATES HÌNH ẢNH
  const [liveFrameIn, setLiveFrameIn] = useState(null);
  const [liveFrameOut, setLiveFrameOut] = useState(null);
  const [capturedImageIn, setCapturedImageIn] = useState(null);
  const [capturedImageOut, setCapturedImageOut] = useState(null);

  // Tham chiếu để quản lý bộ đếm thời gian xóa ảnh
  const timeoutInRef = useRef(null);
  const timeoutOutRef = useRef(null);

  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${now.toLocaleTimeString('en-GB')} - ${now.toLocaleDateString('en-GB').replace(/\//g, ' - ')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const socket = io('http://localhost:5000');
    
    // NGHE LUỒNG VIDEO LIVE
    socket.on('live_frame', (data) => {
      if (data && data.image) {
        if (data.lane_id === 'MAIN-OUT') {
          setLiveFrameOut(data.image);
        } else {
          setLiveFrameIn(data.image);
        }
      }
    });
    
    // NGHE KẾT QUẢ QUÉT AI
    socket.on('scan_result', (data) => {
        const isOutbound = data.lane_id === 'MAIN-OUT';
        
        // Xử lý tên chủ xe
        const fetchedName = data.owner_name;
        const owner = (fetchedName && fetchedName !== 'User' && fetchedName !== 'Khách lạ') ? fetchedName : 'KHÁCH CHƯA ĐĂNG KÝ';

        const payload = {
            result: data.status,
            plate: data.plate,
            owner: owner,
            type: data.vehicle_type || 'N/A',
            access: data.access_type || ''
        };

        if (isOutbound) {
            setOutData(payload);
            setCapturedImageOut(data.captured_image);
            
            // Xóa bộ đếm cũ nếu có xe mới tới liên tục
            if (timeoutOutRef.current) clearTimeout(timeoutOutRef.current);
            
            // Cài đặt 8 giây sau sẽ xóa sạch dữ liệu LÀN RA
            timeoutOutRef.current = setTimeout(() => {
                setOutData(prev => ({ ...prev, result: null }));
                setCapturedImageOut(null); // XÓA ẢNH CHỤP
            }, 8000); 

        } else {
            setInData(payload);
            setCapturedImageIn(data.captured_image);
            
            // Xóa bộ đếm cũ nếu có xe mới tới liên tục
            if (timeoutInRef.current) clearTimeout(timeoutInRef.current);
            
            // Cài đặt 8 giây sau sẽ xóa sạch dữ liệu LÀN VÀO
            timeoutInRef.current = setTimeout(() => {
                setInData(prev => ({ ...prev, result: null }));
                setCapturedImageIn(null); // XÓA ẢNH CHỤP
            }, 8000);
        }
    });

    return () => {
        socket.disconnect();
        if (timeoutInRef.current) clearTimeout(timeoutInRef.current);
        if (timeoutOutRef.current) clearTimeout(timeoutOutRef.current);
    };
  }, []);

  // HÀM VẼ GIAO DIỆN BẢNG TRẠNG THÁI (Dùng chung cho cả In và Out để code gọn)
  const renderStatusPanel = (data, laneLabel) => {
    if (!data.result) {
      return (
        <div className="h-full w-full bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center p-4">
          <p className="text-gray-400 font-bold italic tracking-wider text-sm">System standing by... Waiting for {laneLabel} vehicle.</p>
        </div>
      );
    }

    const isSuccess = data.result === 'success';
    const isAntiPassback = data.access === 'anti_passback';

    return (
      <div className={`h-full w-full flex items-center justify-between px-6 py-3 rounded-xl shadow-lg border-l-8 ${isSuccess ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
        
        {/* Nửa Trái: Thông tin xe */}
        <div className="flex flex-col justify-center space-y-2 h-full">
          <div className="flex items-center space-x-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-black uppercase rounded ${laneLabel === 'OUT' ? 'bg-blue-200 text-blue-800' : 'bg-red-200 text-red-800'}`}>
               LANE {laneLabel}
            </span>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              Log • {new Date().toLocaleTimeString()}
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 font-bold w-12 text-sm">Plate:</span>
            <span className={`text-xl font-black tracking-widest ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>{data.plate}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-gray-600 font-bold w-12 text-sm">Owner:</span>
            <span className={`text-base font-black uppercase truncate max-w-[200px] ${isSuccess ? 'text-[#005B9F]' : 'text-red-600'}`}>{data.owner}</span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-gray-600 font-bold text-sm w-12">Type:</span>
            <span className="text-sm font-bold text-gray-800 capitalize">{data.type}</span>
          </div>
        </div>

        {/* Nửa Phải: Lệnh Đóng/Mở */}
        <div className="flex flex-col items-end justify-center h-full ml-2">
          {isSuccess ? (
            <>
              <p className="text-3xl font-black text-[#005B9F] tracking-tight leading-none">OPEN</p>
              <p className="text-green-600 font-bold mt-1 text-xs uppercase">Authorized</p>
            </>
          ) : isAntiPassback ? (
            <>
              <p className="text-2xl font-black text-orange-500 tracking-tight leading-none">PASSBACK</p>
              <p className="text-orange-600 font-bold mt-1 text-[10px] uppercase">Warning</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-black text-[#FF6B00] tracking-tight leading-none">DENIED</p>
              <p className="text-red-600 font-bold mt-1 text-xs uppercase">Unauthorized</p>
            </>
          )}
        </div>
        
      </div>
    );
  };

  return (
    <div className="h-screen bg-gray-50 font-sans flex flex-col w-full overflow-hidden">
      
      {/* NAVBAR */}
      <div className="bg-[#005B9F] flex items-center justify-between px-6 py-3 shadow-md w-full border-b-4 border-[#FF6B00] shrink-0">
        <div className="flex items-center space-x-6 flex-shrink-0">
          <h1 className="text-2xl font-black italic text-white flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
          <button className="p-1.5 hover:bg-blue-800 rounded-full transition-colors">
            <RotateCw className="w-5 h-5 text-white" />
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
          <span className="cursor-pointer border-b-2 border-white pb-1">DASHBOARD</span>
          <span 
            className="cursor-pointer hover:text-[#FF6B00] transition-colors"
            onClick={() => navigate('/manual-mode')}
          >
            MANUAL MODE
          </span>
        </div>

        <div 
        onClick={() => navigate('/profile')}
        className="flex items-center space-x-2 font-bold text-white flex-shrink-0 bg-blue-800 px-3 py-1.5 rounded-md border border-blue-700 text-sm cursor-pointer hover:bg-blue-700">
          <User className="w-5 h-5" />
          <span>{localStorage.getItem('full_name') || 'GUARD_NAM'}</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 flex flex-col space-y-4 w-full max-w-[1600px] mx-auto min-h-0">
        
        {/* ROW 1: 2 CAMERA LIVE */}
        <div className="flex-[3] grid grid-cols-2 gap-4 min-h-0">
          <div className="bg-[#E5E7EB] relative rounded-xl shadow-inner flex flex-col justify-between p-3 border-2 border-gray-300 w-full h-full overflow-hidden">
            <div className="flex items-center space-x-2 text-sm font-bold z-10 text-black bg-white/80 inline-block px-3 py-1 rounded-md w-max shadow-sm absolute top-3 left-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
              <span>Lane In (Live)</span>
            </div>
            {liveFrameIn ? (
                <img src={liveFrameIn} alt="Live Lane In" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-40 text-black">
                  <span className="font-black text-2xl tracking-widest bg-white/50 px-6 py-2 rounded">CONNECTING CAMERA IN...</span>
                </div>
            )}
            <div className="absolute bottom-3 right-3 text-xs font-bold z-10 text-black bg-white/80 px-2 py-1 rounded-md shadow-sm">{currentTime}</div>
          </div>

          <div className="bg-[#E5E7EB] relative rounded-xl shadow-inner flex flex-col justify-between p-3 border-2 border-gray-300 w-full h-full overflow-hidden">
            <div className="flex items-center space-x-2 text-sm font-bold z-10 text-black bg-white/80 inline-block px-3 py-1 rounded-md w-max shadow-sm absolute top-3 left-3">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
              <span>Lane Out (Live)</span>
            </div>
            {liveFrameOut ? (
                <img src={liveFrameOut} alt="Live Lane Out" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
                <div className="absolute inset-0 flex items-center justify-center opacity-40 text-black">
                  <span className="font-black text-2xl tracking-widest bg-white/50 px-6 py-2 rounded">NO SIGNAL OUT</span>
                </div>
            )}
            <div className="absolute bottom-3 right-3 text-xs font-bold z-10 text-black bg-white/80 px-2 py-1 rounded-md shadow-sm">{currentTime}</div>
          </div>
        </div>

        {/* ROW 2: 2 ẢNH CHỤP BIỂN SỐ */}
        <div className="flex-[1.2] grid grid-cols-2 gap-4 min-h-0">
          <div className="bg-gray-200 relative rounded-lg shadow-inner border border-gray-300 w-full h-full overflow-hidden flex items-center justify-center">
            <div className="absolute top-2 left-2 flex items-center space-x-1 text-xs font-bold z-10 text-gray-700 bg-white/70 px-2 py-0.5 rounded">
              <ArrowRightToLine className="w-4 h-4 text-red-600" />
              <span>Capturing In</span>
            </div>
            {capturedImageIn ? (
               <img src={capturedImageIn} alt="Captured Plate In" className="w-full h-full object-contain bg-black/5" />
            ) : (
               <span className="text-gray-400 font-bold text-sm">Awaiting capture In...</span>
            )}
          </div>

          <div className="bg-gray-200 relative rounded-lg shadow-inner border border-gray-300 w-full h-full overflow-hidden flex items-center justify-center">
            <div className="absolute top-2 left-2 flex items-center space-x-1 text-xs font-bold z-10 text-gray-700 bg-white/70 px-2 py-0.5 rounded">
              <ArrowLeftFromLine className="w-4 h-4 text-blue-600" />
              <span>Capturing Out</span>
            </div>
            {capturedImageOut ? (
               <img src={capturedImageOut} alt="Captured Plate Out" className="w-full h-full object-contain bg-black/5" />
            ) : (
               <span className="text-gray-400 font-bold text-sm">Awaiting capture Out...</span>
            )}
          </div>
        </div>

        {/* ROW 3: BẢNG TRẠNG THÁI (ĐÃ CHIA ĐÔI THÀNH 2 CỘT) */}
        <div className="flex-[1] min-h-0 w-full grid grid-cols-2 gap-4">
          {renderStatusPanel(inData, 'IN')}
          {renderStatusPanel(outData, 'OUT')}
        </div>

      </div>
    </div>
  );
};

export default GuardDashboard;