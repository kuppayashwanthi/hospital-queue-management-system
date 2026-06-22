import React, { useState, useEffect } from 'react';
import { Hospital, Token, UserRole, PatientProfile, StaffProfile } from './types';
import { loadQueueState, saveQueueState, getPatientTokens } from './lib/queueEngine';
import { INITIAL_HOSPITALS } from './data';
import Header from './components/Header';
import LoginView from './components/LoginView';
import HospitalList from './components/HospitalList';
import BookToken from './components/BookToken';
import LiveQueueTracker from './components/LiveQueueTracker';
import AdminDashboard from './components/AdminDashboard';
import { Sparkles, LayoutGrid, Calendar, Clock, Stethoscope, User, HelpCircle, Activity, ArrowRight, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { LanguageType } from './lib/translations';

export default function App() {
  // Localization state
  const [language, setLanguage] = useState<LanguageType>(() => {
    return (localStorage.getItem('carequeue_saved_language') as LanguageType) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('carequeue_saved_language', language);
  }, [language]);

  // Authentication states
  const [currentRole, setCurrentRole] = useState<UserRole>('guest');
  const [patientProfile, setPatientProfile] = useState<PatientProfile | undefined>(undefined);
  const [staffProfile, setStaffProfile] = useState<StaffProfile | undefined>(undefined);

  // Navigation states
  const [currentView, setCurrentView] = useState<'hospitals' | 'book' | 'tracker'>('hospitals');
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);

  // History Tracker for patient
  const [myTickets, setMyTickets] = useState<Token[]>([]);

  // Clock & Sync ticker
  const [tickerTime, setTickerTime] = useState<string>('');
  const [delayNotice, setDelayNotice] = useState<string | null>(null);

  // Initialize and check localStorage
  useEffect(() => {
    // Seed initial state if needed
    loadQueueState();

    // Setup local live clock ticker
    const updateTime = () => {
      const now = new Date();
      setTickerTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const clockInterval = setInterval(updateTime, 1000);

    // Initial role lookup
    const savedRole = localStorage.getItem('carequeue_saved_role');
    const savedPatient = localStorage.getItem('carequeue_saved_patient');
    const savedStaff = localStorage.getItem('carequeue_saved_staff');

    if (savedRole === 'patient' && savedPatient) {
      const p = JSON.parse(savedPatient);
      setCurrentRole('patient');
      setPatientProfile(p);
      reloadMyTickets(p.phone);
    } else if (savedRole === 'staff' && savedStaff) {
      const s = JSON.parse(savedStaff);
      setCurrentRole('staff');
      setStaffProfile(s);
    }

    return () => clearInterval(clockInterval);
  }, []);

  // Sync delay messages and patient's saved tickets list
  const reloadMyTickets = (phone?: string) => {
    const contact = phone || patientProfile?.phone;
    if (contact) {
      const tickets = getPatientTokens(contact);
      setMyTickets(tickets);
      
      // If no active token is watched, auto-pick the most recent active one if it exists
      if (tickets.length > 0) {
        const activeTickets = tickets.filter(t => t.status === 'waiting' || t.status === 'calling');
        if (activeTickets.length > 0) {
          // Sort by creation desc
          activeTickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          
          // Only auto-pick if selectedToken is null
          setSelectedToken(prev => prev || activeTickets[0]);
        }
      }
    }
  };

  useEffect(() => {
    if (currentRole === 'patient' && patientProfile) {
      reloadMyTickets();
      const interval = setInterval(reloadMyTickets, 2500);
      return () => clearInterval(interval);
    }
  }, [currentRole, patientProfile]);

  // Read delay announcement notices for selected facilities
  useEffect(() => {
    if (selectedToken) {
      const delayNoticeKey = `hosp_delay_notice_${selectedToken.hospitalId}_${selectedToken.departmentId}`;
      const checkNotice = () => {
        const notice = localStorage.getItem(delayNoticeKey);
        setDelayNotice(notice);
      };
      checkNotice();
      const interval = setInterval(checkNotice, 2000);
      return () => clearInterval(interval);
    } else {
      setDelayNotice(null);
    }
  }, [selectedToken]);

  // Logins & logouts
  const handlePatientLogin = (profile: PatientProfile) => {
    setCurrentRole('patient');
    setPatientProfile(profile);
    setSelectedToken(null);
    setCurrentView('hospitals');

    localStorage.setItem('carequeue_saved_role', 'patient');
    localStorage.setItem('carequeue_saved_patient', JSON.stringify(profile));
    reloadMyTickets(profile.phone);
  };

  const handleStaffLogin = (profile: StaffProfile) => {
    setCurrentRole('staff');
    setStaffProfile(profile);

    localStorage.setItem('carequeue_saved_role', 'staff');
    localStorage.setItem('carequeue_saved_staff', JSON.stringify(profile));
  };

  const handleLogout = () => {
    setCurrentRole('guest');
    setPatientProfile(undefined);
    setStaffProfile(undefined);
    setSelectedToken(null);
    setMyTickets([]);
    
    localStorage.removeItem('carequeue_saved_role');
    localStorage.removeItem('carequeue_saved_patient');
    localStorage.removeItem('carequeue_saved_staff');
  };

  const handleSelectHospital = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setCurrentView('book');
  };

  const handleBookTokenClick = (hospital: Hospital, deptId?: string) => {
    // If not logged in, dynamically sign them in as a fast guest first!
    if (currentRole !== 'patient') {
      const guestName = 'Quick Guest Patient';
      const guestPhone = '+1 (555) 777-9999';
      handlePatientLogin({ name: guestName, phone: guestPhone });
    }
    
    setSelectedHospital(hospital);
    setCurrentView('book');
  };

  const handleTokenBooked = (token: Token) => {
    setSelectedToken(token);
    setCurrentView('tracker');
    reloadMyTickets();
  };

  // Instant simulator setup
  const simulateDoctorLogin = (hospId: string, deptId: string, doctorName: string) => {
    handleStaffLogin({
      hospitalId: hospId,
      departmentId: deptId,
      staffName: doctorName
    });
  };

  const simulatePatientLogin = (name: string, phone: string) => {
    handlePatientLogin({ name, phone });
  };

  return (
    <div className="min-h-screen bg-[#0a0c10] text-slate-100 pb-20 flex flex-col justify-between" id="app-root-container">
      
      {/* Top Level Nav Header */}
      <div>
        <Header
          currentRole={currentRole}
          patientProfile={patientProfile}
          staffProfile={staffProfile}
          onLogout={handleLogout}
          onSwitchToGuest={() => {
            setCurrentRole('guest');
            localStorage.removeItem('carequeue_saved_role');
          }}
          syncTime={tickerTime}
          language={language}
          onLanguageChange={setLanguage}
        />

        {/* Global Alert Notification Banner */}
        {currentRole === 'patient' && selectedToken && delayNotice && (
          <div className="bg-amber-600 text-white p-3 font-sans text-xs sm:text-sm font-bold text-center border-b border-amber-700/50 animate-pulse flex items-center justify-center gap-1.5" id="delay-broadcast-banner">
            <Clock className="h-4 w-4 shrink-0 text-amber-200" />
            <span>Broadcast from {selectedToken.departmentName}: "{delayNotice}"</span>
          </div>
        )}

        {/* Active main body viewport area */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {currentRole === 'guest' && (
            <LoginView
              onPatientLogin={handlePatientLogin}
              onStaffLogin={handleStaffLogin}
            />
          )}

          {currentRole === 'patient' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="patient-workspace">
              
              {/* Left main workspace window */}
              <div className="lg:col-span-8">
                {currentView === 'hospitals' && (
                  <HospitalList
                    onSelectHospital={handleSelectHospital}
                    onBookTokenClick={handleBookTokenClick}
                    language={language}
                  />
                )}

                {currentView === 'book' && selectedHospital && (
                  <BookToken
                    hospital={selectedHospital}
                    patientName={patientProfile?.name || ''}
                    patientPhone={patientProfile?.phone || ''}
                    onBack={() => setCurrentView('hospitals')}
                    onTokenBooked={handleTokenBooked}
                    language={language}
                  />
                )}

                {currentView === 'tracker' && selectedToken && (
                  <LiveQueueTracker
                    token={selectedToken}
                    onBackToHospitals={() => setCurrentView('hospitals')}
                    onRefresh={reloadMyTickets}
                    language={language}
                  />
                )}
              </div>

              {/* Patient Sidebar: My booked tickets wallet */}
              <div className="lg:col-span-4 space-y-5">
                <div className="bg-[#0f1218] rounded-3xl border border-white/5 p-5 shadow-2xl">
                  <h4 className="font-serif italic font-medium text-slate-100 text-sm mb-4 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-cyan-400 animate-pulse" />
                    My CareQueue Ticket Wallet
                  </h4>

                  {myTickets.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1" id="ticket-wallet-scroll">
                      {myTickets
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                        .map((tk) => {
                          const isActive = selectedToken?.id === tk.id;
                          return (
                            <button
                              key={tk.id}
                              onClick={() => {
                                setSelectedToken(tk);
                                setCurrentView('tracker');
                              }}
                              className={`w-full text-left p-3.5 rounded-2xl border transition-all flex justify-between items-center cursor-pointer ${
                                isActive
                                  ? 'border-cyan-500 bg-cyan-500/5 shadow-lg shadow-cyan-500/5'
                                  : 'border-white/5 hover:border-white/10 bg-white/5'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-extrabold text-cyan-400 text-base">{tk.tokenNumber}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-sans font-bold uppercase tracking-wider ${
                                    tk.status === 'calling' ? 'bg-amber-500/20 text-amber-300 animate-pulse' :
                                    tk.status === 'completed' ? 'bg-emerald-500/20 text-emerald-300' :
                                    tk.status === 'skipped' ? 'bg-rose-500/20 text-rose-300' :
                                    'bg-slate-500/20 text-slate-300'
                                  }`}>
                                    {tk.status}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-200 font-sans font-semibold truncate max-w-[170px]">{tk.hospitalName}</p>
                                <p className="text-[10px] text-slate-500 font-sans">{tk.departmentName}</p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="text-[10px] font-mono font-bold text-slate-400">
                                  {new Date(tk.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                                <span className="text-[11.5px] font-sans font-bold text-cyan-400 flex items-center justify-end gap-0.5 mt-2">
                                  Track Wait
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </span>
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-center py-8 border border-dashed border-white/5 rounded-2xl text-slate-500 text-xs font-sans">
                      <Clock className="h-7 w-7 text-slate-600 mx-auto mb-2" />
                      No booked tokens record. Browse clinical facilities to schedule!
                    </div>
                  )}

                  {currentView !== 'hospitals' && (
                    <button
                      onClick={() => setCurrentView('hospitals')}
                      className="w-full bg-[#14181f] text-cyan-400 hover:text-white hover:bg-cyan-500/10 border border-cyan-500/20 font-sans font-bold text-xs py-2.5 px-4 rounded-xl mt-4 transition-all flex items-center justify-center space-x-2 cursor-pointer group shadow-sm"
                    >
                      <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                      <span>
                        {language === 'en' ? 'Back & Book Another Ticket' : 
                         language === 'hi' ? 'पीछे जाएँ और अगला टोकन लें' : 
                         language === 'te' ? 'వెనుకకు వెళ్లి మరో టోకెన్ తీసుకోండి' : 
                         language === 'ta' ? 'மீண்டும் சென்று புதிய டோக்கன் பெறவும்' : 
                         'പിന്നിലേക്ക് പോയി പുതിയ ടോക്കൺ എടുക്കുക'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Helpful queue advice box */}
                <div className="bg-gradient-to-br from-slate-900 to-[#12161f] text-white border border-white/5 rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -mr-8 -mt-8 pointer-events-none"></div>
                  <HelpCircle className="h-5 w-5 text-cyan-400" />
                  <h5 className="font-serif italic font-medium text-sm tracking-tight text-white">Need clinical assistance?</h5>
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    You can hear automated reception calls or buzzer highlights directly from your tracker view! If you missed a slot, simply request the staff desk to re-queue you.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentRole === 'staff' && staffProfile && (
            <AdminDashboard
              staffProfile={staffProfile}
              syncTime={tickerTime}
            />
          )}
        </main>
      </div>

      {/* FOOTER INTERACTIVE TESTING CONTROLLER BANNER */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4 mb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-800 pb-3">
            <div>
              <span className="inline-flex items-center space-x-1 bg-sky-500/10 text-sky-400 text-[10px] font-mono leading-none tracking-widest uppercase font-bold px-2 py-1 rounded">
                ⚡ CareQueue Simulation Bench
              </span>
              <h4 className="font-sans font-extrabold text-sm text-slate-100 tracking-tight mt-1">
                Cross-Tab Real-Time Sync Testing Suite
              </h4>
            </div>
            
            <p className="text-[11px] text-slate-400 font-sans leading-tight max-w-sm">
              Open this page in a <strong>new tab side-by-side</strong>! Sign as a Patient in one, and Doctor in another. Clinic calls update in real-time.
            </p>
          </div>

          <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 gap-2.5">
            {/* Quick staff 1 */}
            <button
              onClick={() => simulateDoctorLogin('hosp-evergreen', 'dept-gen-med', 'Dr. Sarah Vance')}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-left text-xs text-slate-200 transition-all flex flex-col items-start gap-0.5 cursor-pointer hover:border-sky-500/50"
            >
              <span className="font-extrabold flex items-center gap-1 font-sans text-sky-400 text-[10px] uppercase">
                <Stethoscope className="h-3 w-3" />
                Staff Desk A
              </span>
              <span className="font-semibold text-slate-100">Dr. Sarah Vance</span>
              <span className="text-[10px] text-slate-400 truncate w-full">Evergreen Valley • Gen Medicine</span>
            </button>

            {/* Quick staff 2 */}
            <button
              onClick={() => simulateDoctorLogin('hosp-hope-peds', 'dept-peds-gen', 'Dr. Marcus Brody')}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-left text-xs text-slate-200 transition-all flex flex-col items-start gap-0.5 cursor-pointer hover:border-sky-500/50"
            >
              <span className="font-extrabold flex items-center gap-1 font-sans text-sky-400 text-[10px] uppercase">
                <Stethoscope className="h-3 w-3" />
                Staff Desk B
              </span>
              <span className="font-semibold text-slate-100">Dr. Marcus Brody</span>
              <span className="text-[10px] text-slate-400 truncate w-full">Hope Pediatrics • General Peds</span>
            </button>

            {/* Quick Patient 1 */}
            <button
              onClick={() => simulatePatientLogin('Emma Watson', '+1 (555) 765-4321')}
              className="p-2.5 bg-slate-800 hover:bg-slate-750 border border-slate-700/60 rounded-xl text-left text-xs text-slate-200 transition-all flex flex-col items-start gap-0.5 cursor-pointer hover:border-teal-500/50"
            >
              <span className="font-extrabold flex items-center gap-1 font-sans text-teal-400 text-[10px] uppercase">
                <User className="h-3 w-3" />
                Patient A
              </span>
              <span className="font-bold text-slate-100">Emma Watson (GM-303)</span>
              <span className="text-[10px] text-slate-400">Evergreen Gen Medicine queue</span>
            </button>

            {/* Reset Bench */}
            <button
              onClick={() => {
                localStorage.removeItem('hospital_queue_state_v2');
                setCurrentRole('guest');
                handleLogout();
                window.location.reload();
              }}
              className="p-2.5 bg-slate-800 hover:bg-rose-950 border border-slate-700/60 hover:border-rose-800 rounded-xl text-left text-xs text-slate-200 transition-all flex flex-col items-start gap-1 cursor-pointer"
            >
              <span className="font-extrabold flex items-center gap-1 font-sans text-amber-500 text-[10px] uppercase">
                <Activity className="h-3.5 w-3.5" />
                Queue reset center
              </span>
              <span className="font-bold text-rose-300">Reset Queue Storage State</span>
              <span className="text-[9.5px] text-slate-400">Restarts initial simulator logs and tokens</span>
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
