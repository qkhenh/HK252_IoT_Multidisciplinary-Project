import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, LogOut, User, Zap } from 'lucide-react';
import { io } from 'socket.io-client';

const GuardDashboard = () => {
  const navigate = useNavigate();
  
  const [scanResult, setScanResult] = useState(null);
  const [plateNumber, setPlateNumber] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [liveFrameIn, setLiveFrameIn] = useState(null);
  
  const [ownerName, setOwnerName] = useState('');
  const [vehicleType, setVehicleType] = useState('');

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
    
    socket.on('live_frame', (data) => {
      if (data && data.image) setLiveFrameIn(data.image);
    });
    
    socket.on('scan_result', (data) => {
        setPlateNumber(data.plate);
        setScanResult(data.status);
        setCapturedImage(data.captured_image);
        
        // Lấy dữ liệu THẬT 100% từ Database (thông qua Python)
        const fetchedName = data.owner_name;
        const fetchedType = data.vehicle_type;
        
        if (fetchedName && fetchedName !== 'User' && fetchedName !== 'Khách lạ') {
            setOwnerName(fetchedName);
        } else {
            setOwnerName('KHÁCH CHƯA ĐĂNG KÝ');
        }

        setVehicleType(fetchedType || 'N/A');

        setTimeout(() => {
            setScanResult(null);
            setCapturedImage(null);
        }, 8000); 
    });

    return () => socket.disconnect();
  }, []);

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
          <span className="cursor-pointer hover:text-[#FF6B00] transition-colors">AUTO MODE</span>
          <span className="cursor-pointer hover:text-[#FF6B00] transition-colors">MANUAL MODE</span>
        </div>

        <div className="flex items-center space-x-2 font-bold text-white flex-shrink-0 bg-blue-800 px-3 py-1.5 rounded-md border border-blue-700 text-sm">
          <User className="w-5 h-5" />
          <span>GUARD_NAM</span>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 p-4 flex flex-col space-y-4 w-full max-w-[1600px] mx-auto min-h-0">
        
        {/* CAMERA CHÍNH */}
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
                  <span className="font-black text-2xl tracking-widest bg-white/50 px-6 py-2 rounded">CONNECTING CAMERA...</span>
                </div>
            )}
            <div className="absolute bottom-3 right-3 text-xs font-bold z-10 text-black bg-white/80 px-2 py-1 rounded-md shadow-sm">{currentTime}</div>
          </div>

          <div className="bg-[#E5E7EB] relative rounded-xl shadow-inner flex flex-col justify-between p-3 border-2 border-gray-300 w-full h-full overflow-hidden">
            <div className="flex items-center space-x-2 text-sm font-bold z-10 text-black bg-white/80 inline-block px-3 py-1 rounded-md w-max shadow-sm absolute top-3 left-3">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]"></div>
              <span>Lane Out (Live)</span>
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-40 text-black">
              <span className="font-black text-2xl tracking-widest bg-white/50 px-6 py-2 rounded">NO SIGNAL</span>
            </div>
            <div className="absolute bottom-3 right-3 text-xs font-bold z-10 text-black bg-white/80 px-2 py-1 rounded-md shadow-sm">{currentTime}</div>
          </div>
        </div>

        {/* CAMERA PHỤ */}
        <div className="flex-[1.2] grid grid-cols-2 gap-4 min-h-0">
          <div className="bg-gray-200 relative rounded-lg shadow-inner border border-gray-300 w-full h-full overflow-hidden flex items-center justify-center">
            <div className="absolute top-2 left-2 flex items-center space-x-1 text-xs font-bold z-10 text-gray-700 bg-white/70 px-2 py-0.5 rounded">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Capturing In</span>
            </div>
            {capturedImage ? (
               <img src={capturedImage} alt="Captured Plate" className="w-full h-full object-contain bg-black/5" />
            ) : (
               <span className="text-gray-400 font-bold text-sm">Awaiting capture...</span>
            )}
          </div>

          <div className="bg-gray-200 relative rounded-lg shadow-inner border border-gray-300 w-full h-full overflow-hidden flex items-center justify-center">
            <div className="absolute top-2 left-2 flex items-center space-x-1 text-xs font-bold z-10 text-gray-700 bg-white/70 px-2 py-0.5 rounded">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Capturing Out</span>
            </div>
            <span className="text-gray-400 font-bold text-sm">Awaiting capture...</span>
          </div>
        </div>

        {/* BẢNG TRẠNG THÁI */}
        <div className="flex-[1] min-h-0 w-full">
          {scanResult ? (
            <div className={`h-full w-full flex items-center justify-between px-8 py-4 rounded-xl shadow-xl border-l-8 ${scanResult === 'success' ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
              
              <div className="flex flex-col justify-center space-y-1 h-full">
                <p className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-1">
                  System Log • {new Date().toLocaleTimeString()}
                </p>
                
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 font-bold w-24">Plate:</span>
                  <span className={`text-2xl font-black tracking-widest ${scanResult === 'success' ? 'text-green-700' : 'text-red-700'}`}>{plateNumber}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-gray-600 font-bold w-24">Owner:</span>
                  <span className={`text-lg font-black uppercase ${scanResult === 'success' ? 'text-[#005B9F]' : 'text-red-600'}`}>{ownerName}</span>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 font-bold w-24">Type:</span>
                    <span className="text-base font-bold text-gray-800 capitalize">{vehicleType}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 font-bold w-16">Status:</span>
                    <span className="text-base font-bold text-gray-800">
                      {scanResult === 'success' ? 'Match found in DB' : 'Record not found'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end justify-center h-full">
                {scanResult === 'success' ? (
                  <>
                    <p className="text-5xl font-black text-[#005B9F] tracking-tight">GATE OPEN</p>
                    <p className="text-green-600 font-bold mt-1 text-lg">Action Authorized</p>
                  </>
                ) : (
                  <>
                    <p className="text-5xl font-black text-[#FF6B00] tracking-tight">WARNING</p>
                    <p className="text-red-600 font-bold mt-1 text-lg">Access Denied</p>
                  </>
                )}
              </div>
              
            </div>
          ) : (
            <div className="h-full w-full bg-white rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center">
              <p className="text-gray-400 font-bold italic tracking-wider text-lg">System standing by... Waiting for vehicle trigger.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default GuardDashboard;