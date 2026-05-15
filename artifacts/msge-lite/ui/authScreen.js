/**
 * ui/authScreen.js
 * Centralized AUTH HELPER / AUTH STATE module.
 */

import { supabase } from '../data/supabase.js';
import { setActiveProfileId } from '../data/profileStorage.js';

let _currentUser = null;
let _isGuestMode = true; // Guest mode by default
let _isAuthBusy = false;

// Initial optimistic session check
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    if (data?.session) {
      _currentUser = data.session.user;
      _isGuestMode = false;
    }
  });
}

export function getCurrentUser() {
  return _currentUser;
}

export function isGuestMode() {
  return _isGuestMode;
}

export function isAuthConfigured() {
  return !!supabase;
}

export async function checkUserSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  _currentUser = data?.session?.user || null;
  _isGuestMode = !_currentUser;
  return _currentUser;
}

export function lockAuthUI(container, activeBtn, loadingText) {
  if (activeBtn) {
    if (!activeBtn.dataset.originalText) {
      activeBtn.dataset.originalText = activeBtn.textContent;
    }
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

export async function loginUser(email, password) {
  if (_isAuthBusy) return { error: { message: 'Authentication in progress...' } };
  if (!supabase) return { error: { message: 'Cloud archive unavailable. Running in local collector mode.' } };
  
  _isAuthBusy = true;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  _isAuthBusy = false;
  
  if (data?.session) {
    _currentUser = data.session.user;
    _isGuestMode = false;
    setActiveProfileId(_currentUser.id);
    window.location.reload();
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
    setActiveProfileId(_currentUser.id);
    window.location.reload();
  }
  return { data, error };
}

export async function handleLogout() {
  if (supabase) {
    await supabase.auth.signOut();
  }
  _currentUser = null;
  _isGuestMode = true;
  setActiveProfileId('guest');
  window.location.reload();
}

