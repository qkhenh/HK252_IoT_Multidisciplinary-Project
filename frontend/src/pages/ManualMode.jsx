import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCw, LogOut, User, Zap, AlertTriangle, ShieldAlert, CheckCircle, XOctagon } from 'lucide-react';

const ManualMode = () => {
  const navigate = useNavigate();
  const [gateDirection, setGateDirection] = useState('inbound'); 
  const [reasonInput, setReasonInput] = useState('');
  const [activeOverride, setActiveOverride] = useState(null); 
  const [actionStatus, setActionStatus] = useState(null);
  const [currentTime, setCurrentTime] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(`${now.toLocaleTimeString('en-GB')} - ${now.toLocaleDateString('en-GB').replace(/\//g, ' - ')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleForceOpen = async () => {
    if (reasonInput.trim() === '') {
      alert('⚠️ SYSTEM REQUIREMENT: Please provide a reason for the manual override!');
      return;
    }

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
          action_reason: 'other', // Fixed as per requirement
          note: reasonInput.trim() 
        })
      });

      if (response.ok) {
        setActiveOverride({ direction: gateDirection, reason: reasonInput, startTime: new Date().toLocaleTimeString() });
        setActionStatus({ action: 'OPEN', direction: gateDirection });
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
          note: 'Manual Override ended' 
        })
      });

      if (response.ok) {
        setActionStatus({ action: 'CLOSE', direction: activeOverride.direction });
        setActiveOverride(null);
        setReasonInput(''); 
        setTimeout(() => setActionStatus(null), 3000);
      }
    } catch (error) {
      alert('❌ Connection Error!');
    }
  };

  return (
    <div className="h-screen bg-gray-50 font-sans flex flex-col w-full overflow-hidden">
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
          <div className={`${activeOverride ? 'bg-red-700' : 'bg-gray-800'} text-white p-6 text-center transition-colors duration-500`}>
            <AlertTriangle className={`w-12 h-12 mx-auto mb-2 ${activeOverride ? 'text-white animate-pulse' : 'text-yellow-400'}`} />
            <h2 className="text-2xl font-black tracking-widest">{activeOverride ? '⚠️ EMERGENCY OVERRIDE ACTIVE ⚠️' : 'MANUAL CONTROL PANEL'}</h2>
            <div className="absolute top-4 right-6 text-sm font-bold bg-black/30 px-3 py-1 rounded-md">{currentTime}</div>
          </div>

          <div className="p-8 space-y-8">
            {!activeOverride ? (
              <>
                <div>
                  <label className="block text-gray-700 font-bold mb-3 text-lg">1. Select Gate Direction:</label>
                  <div className="flex space-x-4">
                    <button onClick={() => setGateDirection('inbound')} className={`flex-1 py-4 font-bold rounded-lg border-2 transition-all ${gateDirection === 'inbound' ? 'bg-blue-50 border-[#005B9F] text-[#005B9F] shadow-md' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>INBOUND GATE</button>
                    <button onClick={() => setGateDirection('outbound')} className={`flex-1 py-4 font-bold rounded-lg border-2 transition-all ${gateDirection === 'outbound' ? 'bg-blue-50 border-[#005B9F] text-[#005B9F] shadow-md' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>OUTBOUND GATE</button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-bold mb-3 text-lg">2. Describe Exception Reason:</label>
                  <textarea 
                    value={reasonInput}
                    onChange={(e) => setReasonInput(e.target.value)}
                    placeholder="Enter the reason here (e.g., Ambulance, System Error, VIP Guest...)"
                    className="w-full border-2 border-gray-300 rounded-lg p-5 h-32 resize-none focus:outline-none focus:border-[#005B9F] font-medium text-lg"
                  ></textarea>
                </div>

                <button onClick={handleForceOpen} className="w-full bg-green-600 hover:bg-green-700 text-white font-black text-2xl py-6 rounded-xl shadow-[0_8px_0_rgb(22,101,52)] hover:shadow-[0_4px_0_rgb(22,101,52)] hover:translate-y-1 transition-all flex items-center justify-center space-x-3">
                  <ShieldAlert className="w-8 h-8" /> <span>OPEN GATE</span>
                </button>
              </>
            ) : (
              <div className="bg-red-50 border-4 border-red-200 rounded-xl p-8 text-center space-y-6">
                <div>
                    <p className="text-red-800 font-bold text-xl uppercase">Gate is held open</p>
                    <p className="text-3xl font-black text-red-600 tracking-wider">{activeOverride.direction === 'inbound' ? 'INBOUND GATE' : 'OUTBOUND GATE'}</p>
                </div>
                <div className="bg-white p-4 rounded-lg border border-red-100 text-left w-full max-w-lg mx-auto shadow-sm">
                    <p className="text-gray-800 font-bold"><span className="text-gray-500">Started:</span> {activeOverride.startTime}</p>
                    <p className="text-gray-800 font-bold mt-1"><span className="text-gray-500">Reason:</span> {activeOverride.reason}</p>
                </div>
                <button onClick={handleForceClose} className="w-full bg-red-600 hover:bg-red-700 text-white font-black text-2xl py-6 rounded-xl shadow-[0_8px_0_rgb(153,27,27)] hover:shadow-[0_4px_0_rgb(153,27,27)] hover:translate-y-1 transition-all flex items-center justify-center space-x-3">
                  <XOctagon className="w-8 h-8" /> <span>CLOSE GATE & END SESSION</span>
                </button>
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