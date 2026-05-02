import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, LogOut, User, Zap, AlertTriangle, ShieldAlert, CheckCircle, XOctagon } from 'lucide-react';
import { io } from 'socket.io-client';

const ManualMode = () => {
  const navigate = useNavigate();
  const [gateDirection, setGateDirection] = useState('inbound'); 
  
  // Lưu lại biển số và ẢNH gần nhất mà Auto mode quét được
  const [latestAutoPlate, setLatestAutoPlate] = useState('UNKNOWN');
  const [latestAutoImage, setLatestAutoImage] = useState(null);
  
  const [reasonInput, setReasonInput] = useState('');
  const [activeOverride, setActiveOverride] = useState(null); 
  const [actionStatus, setActionStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${now.toLocaleTimeString('en-GB')} - ${now.toLocaleDateString('en-GB').replace(/\//g, ' - ')}`);
    }, 1000);
    
    const socket = io('http://localhost:5000');
    
    // Hứng cả biển số và ảnh từ luồng Auto
    socket.on('scan_result', (data) => {
        if (data && data.plate) {
            setLatestAutoPlate(data.plate);
            if (data.captured_image) {
                setLatestAutoImage(data.captured_image);
            }
        }
    });

    return () => {
        clearInterval(timer);
        socket.disconnect();
    };
  }, []);

  const handleForceOpen = async () => {
    try {
      const laneId = gateDirection === 'inbound' ? 'MAIN-IN' : 'MAIN-OUT'; 
      const response = await fetch('http://localhost:5000/api/v1/guards/manual-action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}` 
        },
        body: JSON.stringify({ 
          lane_id: laneId, 
          action_type: 'open_barrier', 
          action_reason: 'other', 
          note: 'Opening gate, awaiting guard inspection...' 
        })
      });

      if (response.ok) {
        setActiveOverride({ direction: gateDirection, startTime: new Date().toLocaleTimeString() });
        setActionStatus({ action: 'OPEN', direction: gateDirection });
        
        // Điền sẵn biển số vào ô Reason
        setReasonInput(`${latestAutoPlate}_`);
        
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      alert('❌ Connection Error!');
    }
  };

  const handleForceClose = async () => {
    try {
      const laneId = activeOverride.direction === 'inbound' ? 'MAIN-IN' : 'MAIN-OUT';
      const response = await fetch('http://localhost:5000/api/v1/guards/manual-action', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({ 
          lane_id: laneId, 
          action_type: 'close_barrier', 
          action_reason: 'other',
          note: reasonInput 
        })
      });

      if (response.ok) {
        setActionStatus({ action: 'CLOSE', direction: activeOverride.direction });
        setActiveOverride(null);
        setReasonInput(''); 
        // KHÔNG reset ảnh ở đây để bác bảo vệ mở phát sau vẫn thấy ảnh mới nhất nếu có
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      alert('❌ Connection Error!');
    }
  };

  return (
    <div className="h-screen bg-gray-50 font-sans flex flex-col w-full overflow-hidden">
      {/* NAVBAR */}
      <div className="bg-[#005B9F] flex items-center justify-between px-6 py-3 shadow-md w-full border-b-4 border-[#FF6B00] shrink-0 z-20">
        <div className="flex items-center space-x-6 flex-shrink-0">
          <h1 className="text-2xl font-black italic text-white flex items-center tracking-tighter m-0">
            BKEzPass <Zap size={24} className="text-[#FF6B00] ml-1" fill="#FF6B00" />
          </h1>
          <button className="p-1.5 hover:bg-blue-800 rounded-full transition-colors">
            <RotateCw className="w-5 h-5 text-white" />
          </button>
          <button onClick={() => navigate('/')} className="flex items-center space-x-2 text-sm font-bold text-[#005B9F] hover:bg-gray-200 transition-colors bg-white px-3 py-1.5 rounded-md">
            <LogOut className="w-4 h-4" /> <span>LOG OUT</span>
          </button>
        </div>
        <div className="flex items-center space-x-16 font-bold text-white flex-1 justify-center text-sm tracking-wider">
          <span className="cursor-pointer hover:text-[#FF6B00]" onClick={() => navigate('/guard-dashboard')}>DASHBOARD</span>
          <span className="cursor-pointer border-b-2 border-white pb-1">MANUAL MODE</span>
        </div>
        <div className="flex items-center space-x-2 font-bold text-white bg-blue-800 px-3 py-1.5 rounded-md border border-blue-700 text-sm">
          <User className="w-5 h-5" /> <span>GUARD_NAM</span>
        </div>
      </div>

      <div className="flex-1 p-8 flex flex-col items-center justify-center w-full max-w-[1000px] mx-auto min-h-0 relative">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full overflow-hidden relative z-10">
          <div className={`${activeOverride ? 'bg-red-700' : 'bg-gray-800'} text-white p-6 text-center transition-colors duration-500 relative`}>
            <AlertTriangle className={`w-12 h-12 mx-auto mb-2 ${activeOverride ? 'text-white animate-pulse' : 'text-yellow-400'}`} />
            <h2 className="text-2xl font-black tracking-widest">{activeOverride ? '⚠️ EMERGENCY OVERRIDE ACTIVE ⚠️' : 'MANUAL CONTROL PANEL'}</h2>
            <div className="absolute top-4 right-6 text-sm font-bold bg-black/30 px-3 py-1 rounded-md">{currentTime}</div>
          </div>

          <div className="p-8 space-y-8">
            {!activeOverride ? (
              
              /* STATE 1: BÌNH THƯỜNG */
              <div className="space-y-8">
                <div>
                  <label className="block text-gray-700 font-bold mb-3 text-lg text-center">Select Gate Direction to Override:</label>
                  <div className="flex space-x-6 max-w-2xl mx-auto">
                    <button onClick={() => setGateDirection('inbound')} className={`flex-1 py-6 font-black text-xl rounded-xl border-2 transition-all ${gateDirection === 'inbound' ? 'bg-blue-50 border-[#005B9F] text-[#005B9F] shadow-md scale-105' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>INBOUND GATE</button>
                    <button onClick={() => setGateDirection('outbound')} className={`flex-1 py-6 font-black text-xl rounded-xl border-2 transition-all ${gateDirection === 'outbound' ? 'bg-blue-50 border-[#005B9F] text-[#005B9F] shadow-md scale-105' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>OUTBOUND GATE</button>
                  </div>
                </div>

                <div className="pt-4 max-w-2xl mx-auto">
                    <button onClick={handleForceOpen} className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-2xl py-6 rounded-xl shadow-[0_8px_0_rgb(22,101,52)] hover:shadow-[0_4px_0_rgb(22,101,52)] hover:translate-y-1 transition-all flex items-center justify-center space-x-3">
                    <ShieldAlert className="w-8 h-8" /> <span>OPEN GATE</span>
                    </button>
                </div>
              </div>

            ) : (
              
              /* STATE 2: CỔNG ĐANG MỞ (Chia 2 cột: Ảnh & Lý do) */
              <div className="bg-red-50 border-4 border-red-200 rounded-xl p-6 text-center space-y-6">
                <div>
                    <p className="text-red-800 font-bold text-xl uppercase mb-1">Gate is held open</p>
                    <p className="text-3xl font-black text-red-600 tracking-wider">{activeOverride.direction === 'inbound' ? 'INBOUND GATE' : 'OUTBOUND GATE'}</p>
                    <p className="text-gray-500 font-bold text-sm mt-2">Opened at: {activeOverride.startTime}</p>
                </div>
                
                <div className="flex gap-6 items-stretch w-full max-w-4xl mx-auto">
                    {/* CỘT TRÁI: KHUNG ẢNH */}
                    <div className="flex-1 bg-white rounded-lg border border-red-100 shadow-sm p-3 flex flex-col justify-center items-center h-64 relative">
                        <p className="text-gray-500 font-bold text-sm uppercase tracking-wider mb-2 absolute top-3 bg-white/80 px-3 rounded shadow-sm z-10">📸 AI Snapshot</p>
                        {latestAutoImage ? (
                            <img src={latestAutoImage} alt="Latest AI Capture" className="w-full h-full object-contain rounded" />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center rounded border border-gray-200">
                                <span className="text-gray-400 font-bold italic">No vehicle detected yet...</span>
                            </div>
                        )}
                    </div>

                    {/* CỘT PHẢI: ĐIỀN LÝ DO & ĐÓNG CỬA */}
                    <div className="flex-1 flex flex-col justify-between space-y-4">
                        <div className="bg-white p-4 rounded-lg border border-red-100 text-left shadow-sm h-full flex flex-col">
                            <label className="block text-gray-700 font-bold mb-2 text-sm uppercase">📝 Exception Reason / Fix Plate:</label>
                            <textarea 
                                value={reasonInput}
                                onChange={(e) => setReasonInput(e.target.value)}
                                className="w-full border-2 border-gray-300 rounded-lg p-3 flex-1 resize-none focus:outline-none focus:border-red-500 font-bold text-lg text-gray-800 bg-gray-50"
                            ></textarea>
                            <p className="text-[11px] text-gray-400 mt-2 italic font-bold">Format: [Plate Number]_[Reason Details]</p>
                        </div>

                        <button onClick={handleForceClose} className="w-full h-20 shrink-0 bg-red-600 hover:bg-red-700 text-white font-black text-xl rounded-xl shadow-[0_6px_0_rgb(153,27,27)] hover:shadow-[0_3px_0_rgb(153,27,27)] hover:translate-y-1 transition-all flex flex-col items-center justify-center">
                          <div className="flex items-center space-x-2"><XOctagon className="w-6 h-6" /> <span>CLOSE GATE & END</span></div>
                        </button>
                    </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {actionStatus && (
        <div className="fixed top-20 right-6 bg-gray-800 border-l-4 border-green-500 p-4 rounded-lg flex items-center space-x-3 shadow-2xl z-50">
          <CheckCircle className="w-6 h-6 text-green-400" />
          <div>
            <p className="font-bold text-green-400 uppercase">{actionStatus.action} COMMAND SENT!</p>
            <p className="text-gray-300 text-xs">Transmitted to Hardware Gateway.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManualMode;