/**
 * ui/authScreen.js — Phase 10
 * Premium authentication experience for the Collector Archive system.
 */

import { supabase } from '../data/supabase.js';

let _onAuthenticatedCallback = null;
let _onGuestCallback = null;
let _isGuestMode = false;
let _isInitialized = false; 
let _isAuthBusy = false; // Issue #3 solved: Unified execution lock

// Exporting user session for settings screen access
let _currentUser = null;
export function getCurrentUser() {
  return _currentUser;
}
export function isGuestMode() {
  return _isGuestMode;
}
export function isAuthConfigured() {
  return !!supabase;
}

export function lockAuthUI(container, activeBtn, loadingText) {
  if (activeBtn) {
    if (!activeBtn.dataset.originalText) activeBtn.dataset.originalText = activeBtn.textContent;
    activeBtn.textContent = loadingText;
  }
  if (container) {
    container.querySelectorAll('button').forEach(b => b.disabled = true);
    container.querySelectorAll('input').forEach(i => i.disabled = true);
  }
}

export function unlockAuthUI(container, activeBtn) {
  if (activeBtn && activeBtn.dataset.originalText) {
    activeBtn.textContent = activeBtn.dataset.originalText;
  }
  if (container) {
    container.querySelectorAll('button').forEach(b => b.disabled = false);
    container.querySelectorAll('input').forEach(i => i.disabled = false);
  }
}

export function initAuth(onAuthenticated, onGuest) {
  _onAuthenticatedCallback = (session) => {
    _currentUser = session?.user || null;
    _isGuestMode = false;
    if (onAuthenticated) onAuthenticated(session);
  };
  
  _onGuestCallback = () => {
    _currentUser = null;
    _isGuestMode = true;
    if (onGuest) onGuest();
  };

  if (_isInitialized) return;
  _isInitialized = true;

  const loginBtn = document.getElementById('auth-login-btn');
  const signupBtn = document.getElementById('auth-signup-btn');
  const guestBtn = document.getElementById('auth-guest-btn');

  if (loginBtn) loginBtn.addEventListener('click', handleLogin);
  if (signupBtn) signupBtn.addEventListener('click', handleSignUp);
  if (guestBtn) guestBtn.addEventListener('click', handleGuest);
}

export async function checkUserSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Session check error:', error.message);
    return null;
  }
  if (data.session) {
    _currentUser = data.session.user;
    _isGuestMode = false;
  }
  return data.session;
}

function getCredentials() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  return { email, password };
}

function showError(msg) {
  const errEl = document.getElementById('auth-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
}

function hideError() {
  const errEl = document.getElementById('auth-error');
  if (errEl) {
    errEl.textContent = '';
    errEl.classList.add('hidden');
  }
}

export async function loginUser(email, password) {
  if (_isAuthBusy) return { error: { message: 'Authentication in progress...' } };
  if (!supabase) return { error: { message: 'Cloud archive unavailable. Running in local collector mode.' } };
  
  _isAuthBusy = true;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  _isAuthBusy = false;
  
  if (data?.session) {
    _currentUser = data.session.user;
    _isGuestMode = false;
  }
  return { data, error };
}

export async function signUpUser(email, password) {
  if (_isAuthBusy) return { error: { message: 'Authentication in progress...' } };
  if (!supabase) return { error: { message: 'Cloud archive unavailable. Running in local collector mode.' } };
  
  _isAuthBusy = true;
  const { data, error } = await supabase.auth.signUp({ email, password });
  _isAuthBusy = false;
  
  if (data?.session) {
    _currentUser = data.session.user;
    _isGuestMode = false;
  }
  return { data, error };
}

export async function handleLogin() {
  if (_isAuthBusy) return; // Prevent overlapping requests
  if (!supabase) { showError('Cloud archive unavailable. Running in local collector mode.'); return; }
  
  hideError();
  const { email, password } = getCredentials();
  if (!email || !password) {
    showError('Please enter an email and password.');
    return;
  }

  _isAuthBusy = true;
  const loginBtn = document.getElementById('auth-login-btn');
  const container = document.querySelector('.auth-panel');
  lockAuthUI(container, loginBtn, 'CONNECTING...');
  
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  
  _isAuthBusy = false;
  unlockAuthUI(container, loginBtn);

  // Issue #1 & #2 solved: If they clicked guest while this was pending, ABORT.
  if (_isGuestMode) return; 

  if (error) {
    showError(error.message);
  } else if (data.session) {
    transitionOutOfAuth(() => {
      if (_onAuthenticatedCallback) _onAuthenticatedCallback(data.session);
    });
  }
}

export async function handleSignUp() {
  if (_isAuthBusy) return;
  if (!supabase) { showError('Cloud archive unavailable. Running in local collector mode.'); return; }
  
  hideError();
  const { email, password } = getCredentials();
  if (!email || !password) {
    showError('Please enter an email and password.');
    return;
  }

  _isAuthBusy = true;
  const signupBtn = document.getElementById('auth-signup-btn');
  const container = document.querySelector('.auth-panel');
  lockAuthUI(container, signupBtn, 'CREATING...');
  
  const { data, error } = await supabase.auth.signUp({ email, password });
  
  _isAuthBusy = false;
  unlockAuthUI(container, signupBtn);

  // Abort if they bailed to guest mode during the request
  if (_isGuestMode) return;

  if (error) {
    showError(error.message);
  } else if (data.session) {
    transitionOutOfAuth(() => {
      if (_onAuthenticatedCallback) _onAuthenticatedCallback(data.session);
    });
  } else {
    showError('Check your email for the confirmation link.');
  }
}

function handleGuest() {
  if (_isAuthBusy) return; // Don't interrupt a currently processing login
  
  hideError();
  _isGuestMode = true; // This now acts as our kill-switch for pending auth requests
  
  const container = document.querySelector('.auth-panel');
  lockAuthUI(container, null, ''); 
  
  transitionOutOfAuth(() => {
    if (_onGuestCallback) _onGuestCallback();
    // We do NOT reset unlockAuthUI here, because the UI is gone 
    // and we want it to stay locked until the app finishes booting.
  });
}

export async function handleLogout() {
  if (supabase) await supabase.auth.signOut();
  _currentUser = null;
  _isGuestMode = false;
  window.location.reload();
}

export function showAuthScreen() {
  const authScreen = document.getElementById('auth-screen');
  if (!authScreen) return;
  
  // Reset states when showing the screen
  _isGuestMode = false;
  _isAuthBusy = false;
  
  const container = document.querySelector('.auth-panel');
  const loginBtn = document.getElementById('auth-login-btn');
  const signupBtn = document.getElementById('auth-signup-btn');
  
  unlockAuthUI(container, loginBtn);
  unlockAuthUI(container, signupBtn);
  
  hideError();
  
  authScreen.style.display = 'flex';
  requestAnimationFrame(() => {
    authScreen.classList.remove('hidden');
  });
}

function transitionOutOfAuth(onComplete) {
  const authScreen = document.getElementById('auth-screen');
  if (!authScreen) {
    if (onComplete) onComplete();
    return;
  }
  authScreen.classList.add('hidden');
  setTimeout(() => {
    authScreen.style.display = 'none';
    if (onComplete) onComplete();
  }, 300);
}

