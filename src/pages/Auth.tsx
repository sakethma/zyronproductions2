import React, { useState } from 'react';

interface AuthProps {
  onSignInSuccess: (user: any) => void;
  setCurrentRoute: (route: string) => void;
  redirectUrl?: string;
}

export default function Auth({ onSignInSuccess, setCurrentRoute, redirectUrl = '/' }: AuthProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const endpoint = isSignUp ? '/api/auth/register' : '/api/auth/login';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail, password })
      });
      
      const data = await res.json();
      
      if (res.ok && data.user && data.token) {
        localStorage.setItem('dev_token', data.token);
        onSignInSuccess(data.user);
        setCurrentRoute(redirectUrl);
      } else {
        setErrorMsg(data.error || 'Failed to authenticate');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'Verification code sent to your email.');
        if (data.code) {
          setResetCode(data.code);
        }
        setResetStep(2);
      } else {
        setErrorMsg(data.error || 'Failed to send reset code.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !resetCode || !newPassword) return;
    
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: normalizedEmail, code: resetCode.trim(), newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('Password updated successfully! You can now sign in.');
        setIsForgotPassword(false);
        setResetStep(1);
        setResetCode('');
        setNewPassword('');
        setPassword('');
      } else {
        setErrorMsg(data.error || 'Failed to reset password.');
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md bg-white dark:bg-neutral-900 p-8 rounded-xl shadow-sm border border-neutral-200 dark:border-neutral-800">
        
        {isForgotPassword ? (
          <>
            <h2 className="text-3xl font-bold text-center mb-8">Reset Password</h2>
            
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800/30">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                {successMsg}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input 
                    type="email" 
                    required
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent"
                    placeholder="you@example.com"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity mt-2 cursor-pointer"
                >
                  {loading ? 'Sending code...' : 'Send Reset Code'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(false);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2.5 px-4 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors mt-2 cursor-pointer"
                >
                  Back to Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <input 
                    type="email" 
                    disabled
                    value={email}
                    className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-850 opacity-70"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">6-Digit Code</label>
                  <input 
                    type="text" 
                    required
                    maxLength={6}
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                    className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent font-mono text-center tracking-widest text-lg"
                    placeholder="123456"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">New Password</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity mt-2 cursor-pointer"
                >
                  {loading ? 'Resetting...' : 'Set New Password'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetStep(1);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="w-full py-2.5 px-4 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-lg font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors mt-2 cursor-pointer"
                >
                  Request New Code
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-center mb-8">{isSignUp ? 'Create Account' : 'Sign In'}</h2>
            
            {errorMsg && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-200 dark:border-red-800/30">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm rounded-lg border border-emerald-200 dark:border-emerald-800/30">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input 
                  type="email" 
                  required
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium">Password</label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setErrorMsg('');
                        setSuccessMsg('');
                      }}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                    >
                      Forgot Password?
                    </button>
                  )}
                </div>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-black dark:bg-white text-white dark:text-black rounded-lg font-medium hover:opacity-90 transition-opacity mt-2 cursor-pointer"
              >
                {loading ? 'Authenticating...' : (isSignUp ? 'Sign Up securely' : 'Sign in securely')}
              </button>
            </form>
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setErrorMsg('');
                  setSuccessMsg('');
                }}
                className="text-sm text-neutral-500 hover:text-black dark:hover:text-white transition-colors cursor-pointer"
              >
                {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
