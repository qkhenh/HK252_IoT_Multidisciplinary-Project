import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import GuardDashboard from './pages/GuardDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/guard-dashboard" element={<GuardDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;