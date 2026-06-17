import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import logoLight from '../assest/Logo_light_mode.png';
import logoDark from '../assest/Logo_dark_mode.png';

interface AuthProps {
    initialMode?: 'login' | 'signup' | 'verify';
}

const Auth: React.FC<AuthProps> = ({ initialMode = 'login' }) => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [activeTab, setActiveTab] = useState<'student' | 'counsellor' | 'admin'>('student');
    const [isLogin, setIsLogin] = useState(initialMode === 'login');
    const [step, setStep] = useState<'auth' | 'verify'>(initialMode === 'verify' ? 'verify' : 'auth');
    const [loading, setLoading] = useState(false);

    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        setIsLogin(initialMode === 'login');
        if (initialMode === 'verify') setStep('verify');
        else setStep('auth');
    }, [initialMode]);

    const [formData, setFormData] = useState({
        email: '',
        username: '',
        password: '',
        phone: '',
        experience: 0,
        certification: '',
        otp: '',
        notify_on_crisis: true
    });

    const showModal = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        setModal({ isOpen: true, title, message, type });
    };

    const closeModal = () => {
        setModal({ ...modal, isOpen: false });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isLogin) {
            if (formData.password.length < 8) {
                showModal('Invalid Password', 'Password must be at least 8 characters long.', 'warning');
                return;
            }
            if (formData.password.length > 72) {
                showModal('Invalid Password', 'Password is too long. Maximum 72 characters allowed.', 'warning');
                return;
            }
        }
        setLoading(true);
        try {
            if (isLogin) {
                const res = await api.post('/auth/login', {
                    email: formData.email,
                    password: formData.password
                });
                login(res.data.access_token, res.data);
                showModal('Welcome Back!', `Successfully logged in as ${res.data.username}`, 'success');
                setTimeout(() => navigate('/'), 1500);
            } else {
                const payload: any = {
                    email: formData.email,
                    username: formData.username,
                    password: formData.password,
                    role: activeTab,
                };

                if (activeTab === 'counsellor') {
                    payload.phone = formData.phone;
                    payload.experience = Number(formData.experience);
                    payload.certification = formData.certification;
                }

                if (activeTab === 'student') {
                    payload.notify_on_crisis = formData.notify_on_crisis;
                }

                await api.post('/auth/register', payload);

                if (activeTab === 'counsellor') {
                    showModal(
                        'Verification Required',
                        `Registration successful! We've sent a verification code to ${formData.email}. Please check your email.`,
                        'info'
                    );
                    setTimeout(() => setStep('verify'), 2000);
                } else {
                    showModal(
                        'Registration Successful!',
                        'Your account has been created. Logging you in...',
                        'success'
                    );
                    setTimeout(async () => {
                        const res = await api.post('/auth/login', {
                            email: formData.email,
                            password: formData.password
                        });
                        login(res.data.access_token, res.data);
                        navigate('/');
                    }, 1500);
                }
            }
        } catch (err: any) {
            console.error("Auth Error:", err);
            const msg = err.response?.data?.detail || "Connection Error. Please ensure backend is running.";
            showModal('Authentication Error', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post('/auth/verify-email', { email: formData.email, otp: formData.otp });
            showModal(
                'Email Verified!',
                'Your account has been verified successfully. You can now login.',
                'success'
            );
            setTimeout(() => navigate('/login'), 2000);
        } catch (err: any) {
            const msg = err.response?.data?.detail || "Verification failed";
            showModal('Verification Failed', msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'verify') {
        return (
            <>
                <Modal {...modal} onClose={closeModal} />
                <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f6ff] p-4">
                    <div className="w-full max-w-xl bg-white rounded-[32px] shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-10 border border-[#ece9ff] animate-fade-soft">
                        <div className="text-center mb-6">
                            <div className="w-24 h-24 mx-auto mb-4">
                                <img src={logoLight} alt="Sonder logo" className="h-full w-full object-contain block dark:hidden mx-auto" />
                                <img src={logoDark} alt="Sonder logo" className="h-full w-full object-contain hidden dark:block mx-auto" />
                            </div>
                            <h2 className="text-4xl font-semibold text-zinc-900">Verify Your Email</h2>
                            <p className="mt-3 text-base text-zinc-500 max-w-xl mx-auto leading-7">
                                Enter the OTP sent to <span className="font-semibold text-[#7c3aed]">{formData.email}</span> so we can keep your Sonder experience safe.
                            </p>
                        </div>

                        <form onSubmit={handleVerify} className="space-y-4">
                            <input
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email"
                                className="w-full p-4 bg-[#fbfbfe] border border-[#e5e7ff] rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] text-zinc-900"
                                required
                            />
                            <input
                                name="otp"
                                value={formData.otp}
                                onChange={handleChange}
                                placeholder="Enter 6-digit OTP"
                                className="w-full p-4 bg-[#fbfbfe] border border-[#e5e7ff] rounded-[20px] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] text-center text-2xl tracking-widest font-mono text-zinc-900"
                                maxLength={6}
                                required
                            />
                            <button
                                disabled={loading}
                                className="w-full rounded-[24px] bg-gradient-to-r from-[#c7d2fe] via-[#e9d5ff] to-[#fed7aa] text-zinc-950 p-4 font-semibold shadow-lg shadow-[#c7d2fe]/20 hover:opacity-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? 'Verifying...' : 'Verify Email'}
                            </button>
                        </form>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Modal {...modal} onClose={closeModal} />
            <div className="flex flex-col items-center justify-center min-h-screen bg-[#f8f6ff] p-4">
                <div className="w-full max-w-xl bg-white rounded-[32px] shadow-[0_30px_70px_rgba(15,23,42,0.08)] p-10 border border-[#ece9ff] animate-fade-soft">
                    <div className="text-center mb-8">
                        <div className="w-24 h-24 mx-auto mb-4">
                            <img src={logoLight} alt="Sonder logo" className="h-full w-full object-contain block dark:hidden mx-auto" />
                            <img src={logoDark} alt="Sonder logo" className="h-full w-full object-contain hidden dark:block mx-auto" />
                        </div>
                        <h2 className="text-4xl font-semibold text-zinc-900">
                            {isLogin ? 'Welcome Back' : 'Join Sonder'}
                        </h2>
                        <p className="mt-3 text-base text-zinc-500 max-w-lg mx-auto leading-7">
                            {isLogin ? 'Continue your wellness journey' : 'Start your mental wellness journey'}
                        </p>
                    </div>

                    <div className="flex mb-6 bg-[#f5f3ff] p-1 rounded-[24px] shadow-sm">
                        {(['student', 'counsellor', 'admin'] as const).map((role) => (
                            <button
                                key={role}
                                onClick={() => setActiveTab(role)}
                                className={`flex-1 py-3 text-sm font-medium rounded-[20px] capitalize transition-all ${activeTab === role
                                    ? 'bg-white shadow-sm text-[#7c3aed]'
                                    : 'text-zinc-500 hover:text-zinc-700'
                                    }`}
                            >
                                {role}
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <input
                            name="email"
                            type="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Email Address"
                            className="w-full p-4 bg-[#fbfbfe] border border-[#e5e7ff] rounded-[22px] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] text-zinc-900"
                            required
                        />

                        {!isLogin && (
                            <input
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Username"
                                className="w-full p-4 bg-[#fbfbfe] border border-[#e5e7ff] rounded-[22px] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] text-zinc-900"
                                required
                            />
                        )}

                        <input
                            name="password"
                            type="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Password"
                            className="w-full p-4 bg-[#fbfbfe] border border-[#e5e7ff] rounded-[22px] focus:outline-none focus:ring-2 focus:ring-[#c7d2fe] text-zinc-900"
                            required
                        />

                        {!isLogin && activeTab === 'student' && (
                            <div className="flex items-start gap-3 p-4 bg-[#f5f3ff] rounded-[22px] border border-[#ece9ff]">
                                <input
                                    id="notify_on_crisis"
                                    name="notify_on_crisis"
                                    type="checkbox"
                                    checked={formData.notify_on_crisis}
                                    onChange={(e) => setFormData({ ...formData, notify_on_crisis: e.target.checked })}
                                    className="mt-1 h-5 w-5 rounded border-[#c7d2fe] text-[#7c3aed] focus:ring-[#c7d2fe]"
                                />
                                <label htmlFor="notify_on_crisis" className="text-sm text-zinc-600 leading-normal cursor-pointer select-none">
                                    I consent to sharing crisis alert details with verified counsellors in case of high-risk indicators to receive support.
                                </label>
                            </div>
                        )}

                        {!isLogin && activeTab === 'counsellor' && (
                            <>
                                <input
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    placeholder="Phone Number"
                                    className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                    required
                                />
                                <input
                                    name="experience"
                                    type="number"
                                    value={formData.experience}
                                    onChange={handleChange}
                                    placeholder="Years of Experience"
                                    className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                    required
                                />
                                <input
                                    name="certification"
                                    value={formData.certification}
                                    onChange={handleChange}
                                    placeholder="Certification / Degree"
                                    className="w-full p-3 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white"
                                    required
                                />
                            </>
                        )}

                        {!isLogin && activeTab === 'admin' && (
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                                <p className="text-sm text-amber-800 dark:text-amber-400">
                                    ⚠️ Admin accounts cannot be created through signup. Please contact the system administrator.
                                </p>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || (!isLogin && activeTab === 'admin')}
                            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-rose-600 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => navigate(isLogin ? '/signup' : '/login')}
                            className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                        >
                            {isLogin ? 'Sign up' : 'Login'}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Auth;
