const HOST = window.location.host;
const PROTOCOL = window.location.protocol; // Protocol-aware (HTTPS/HTTP)

const API = {
    auth: `${PROTOCOL}//${HOST}/api/auth`,
    wash: `${PROTOCOL}//${HOST}/api/car-wash`,
    booking: `${PROTOCOL}//${HOST}/api/booking`,
    notification: `${PROTOCOL}//${HOST}/api/notification`
};

let currentUser = null;
let currentAuthMode = 'login'; // 'login' or 'register'
let selectedWashId = null;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
        currentUser = JSON.parse(userStr);
        updateNavState();
    }
    fetchCarWashes();
});

// UI Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.add('active');
    
    if (pageId === 'dashboard') {
        if (!currentUser) return showAuth('login');
        fetchMyBookings();
    }
    
    if (pageId === 'admin-dashboard') {
        if (!currentUser || currentUser.role !== 'admin') return showPage('home');
        fetchAdminBookings();
    }
    
    if (pageId === 'notifications') {
        if (!currentUser) return showAuth('login');
        fetchMyNotifications();
    }
}

// Auth UI
function showAuth(mode) {
    currentAuthMode = mode;
    document.getElementById('auth-title').innerText = mode === 'login' ? 'Log In' : 'Sign Up';
    document.getElementById('auth-submit').innerText = mode === 'login' ? 'Log In' : 'Sign Up';
    document.querySelector('.toggle-auth').innerText = mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Log in";
    document.getElementById('auth-error').innerText = '';
    
    // Toggle role and phone fields
    document.getElementById('auth-role').style.display = mode === 'login' ? 'none' : 'block';
    const phoneInput = document.getElementById('auth-phone');
    phoneInput.style.display = mode === 'login' ? 'none' : 'block';
    if (mode === 'login') { phoneInput.removeAttribute('required'); } else { phoneInput.setAttribute('required', 'true'); }
    
    document.getElementById('auth-modal').style.display = 'flex';
}

function toggleAuthMode() {
    showAuth(currentAuthMode === 'login' ? 'register' : 'login');
}

function closeModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
}

function updateNavState() {
    if (currentUser) {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('user-section').style.display = 'flex';
        document.getElementById('user-email').innerText = currentUser.email;
        if (currentUser.role === 'admin') {
            const adminDash = document.getElementById('nav-admin-dashboard');
            if (adminDash) adminDash.style.display = 'inline-block';
            const userDash = document.getElementById('nav-dashboard');
            if (userDash) userDash.style.display = 'none';
        } else {
            const userDash = document.getElementById('nav-dashboard');
            if (userDash) userDash.style.display = 'inline-block';
            const adminDash = document.getElementById('nav-admin-dashboard');
            if (adminDash) adminDash.style.display = 'none';
        }
    } else {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('user-section').style.display = 'none';
        const userDash = document.getElementById('nav-dashboard');
        if (userDash) userDash.style.display = 'none';
        const adminDash = document.getElementById('nav-admin-dashboard');
        if (adminDash) adminDash.style.display = 'none';
        showPage('home');
    }
}

// API Calls
async function handleAuth(e) {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    const password = document.getElementById('auth-password').value;
    const phone_number = document.getElementById('auth-phone').value || "0000000000";
    const role = currentAuthMode === 'register' ? document.getElementById('auth-role').value : 'user';
    const errorEl = document.getElementById('auth-error');
    errorEl.innerText = 'Loading...';

    const endpoint = currentAuthMode === 'login' ? '/login' : '/register';
    
    const payload = currentAuthMode === 'login' ? { email, password } : { email, password, role, phone_number };
    
    try {
        const res = await fetch(`${API.auth}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.detail || 'Authentication failed');
        
        if (currentAuthMode === 'register') {
            // Hide auth modal, show OTP modal
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('otp-modal').style.display = 'flex';
            // Save email temporarily for OTP verification
            document.getElementById('otp-modal').dataset.email = email;
            return;
        }
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        
        closeModals();
        updateNavState();
        
        if (currentUser.role === 'admin') {
            showPage('admin-dashboard');
        } else {
            showPage('home');
        }
    } catch (err) {
        errorEl.innerText = err.message;
    }
}

async function verifyOTP(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-code').value;
    const email = document.getElementById('otp-modal').dataset.email;
    const errorEl = document.getElementById('otp-error');
    errorEl.innerText = 'Verifying...';
    
    try {
        const res = await fetch(`${API.auth}/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'OTP Verification failed');
        
        localStorage.setItem('token', data.access_token);
        localStorage.setItem('user', JSON.stringify(data.user));
        currentUser = data.user;
        
        closeModals();
        updateNavState();
        
        if (currentUser.role === 'admin') {
            showPage('admin-dashboard');
        } else {
            showPage('home');
        }
    } catch (err) {
        errorEl.innerText = err.message;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    currentUser = null;
    updateNavState();
}

async function fetchCarWashes() {
    const grid = document.getElementById('wash-grid');
    if (!grid) return;
    try {
        const res = await fetch(`${API.wash}/car_washes`);
        const washes = await res.json();
        
        if (washes.length === 0) {
            grid.innerHTML = '<p>No car washes available at the moment.</p>';
            return;
        }

        grid.innerHTML = washes.map(w => `
            <div class="card p-6 bg-slate-900/40 border border-white/5 rounded-3xl backdrop-blur-md">
                <h3 class="text-xl font-bold text-white">${w.name}</h3>
                <p class="text-slate-400 mt-2">📍 ${w.location}</p>
                <p class="text-emerald-400 mt-1 font-bold">⭐ ${w.rating} / 5.0</p>
                <div style="margin-top: 1rem;">
                    ${w.services.map(s => `<div style="font-size: 0.9rem; margin-bottom: 0.2rem;" class="text-slate-300">- ${s.name} <span class="text-emerald-500 font-bold">$${s.price}</span> (${s.duration_minutes}m)</div>`).join('')}
                </div>
                ${(!currentUser || currentUser.role !== 'admin') ? 
                  `<button class="btn-primary w-full mt-6 py-3 bg-emerald-600 rounded-xl font-bold" onclick='openBooking(${JSON.stringify(w)})'>Book Now</button>` 
                  : '<p style="color:var(--text-muted); margin-top:1rem; font-size:0.9rem;">Admins cannot book services.</p>'}
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<p class="error-text">Failed to load car washes. Ensure backend is running.</p>';
    }
}

function openBooking(wash) {
    if (!currentUser) return showAuth('login');
    
    selectedWashId = wash.id;
    document.getElementById('book-wash-name').innerText = wash.name;
    const select = document.getElementById('book-service');
    // Store owner_id in the dataset of the select element so handleBooking can read it
    select.dataset.ownerId = wash.owner_id;
    select.innerHTML = wash.services.map(s => 
        `<option value='${JSON.stringify(s)}'>${s.name} - $${s.price} (${s.duration_minutes}m)</option>`
    ).join('');
    
    document.getElementById('booking-error').innerText = '';
    document.getElementById('booking-success').innerText = '';
    document.getElementById('booking-modal').style.display = 'flex';
}

async function handleBooking(e) {
    e.preventDefault();
    const serviceData = JSON.parse(document.getElementById('book-service').value);
    const errorEl = document.getElementById('booking-error');
    const successEl = document.getElementById('booking-success');
    
    errorEl.innerText = '';
    successEl.innerText = 'Processing booking...';

    try {
        const res = await fetch(`${API.booking}/bookings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                car_wash_id: selectedWashId,
                car_wash_owner_id: document.getElementById('book-service').dataset.ownerId,
                service_name: serviceData.name,
                duration_minutes: serviceData.duration_minutes
            })
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Booking failed');
        
        successEl.innerText = `Booking confirmed! Your queue number is ${data.queue_number}. Est wait: ${data.estimated_wait_time_minutes} mins.`;
        setTimeout(() => {
            closeModals();
            showPage('dashboard');
        }, 3000);
    } catch (err) {
        successEl.innerText = '';
        errorEl.innerText = err.message;
    }
}

async function fetchMyBookings() {
    const list = document.getElementById('bookings-list');
    if (!list) return;
    list.innerHTML = '<div class="loader">Loading bookings...</div>';
    
    try {
        const res = await fetch(`${API.booking}/bookings/my`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const bookings = await res.json();
        
        if (bookings.length === 0) {
            list.innerHTML = '<p>You have no bookings yet.</p>';
            return;
        }

        list.innerHTML = bookings.map(b => `
            <li class="p-4 bg-white/5 rounded-xl mb-3 border border-white/5">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong class="text-white">${b.service_name}</strong>
                        <div style="font-size: 0.8rem;" class="text-slate-500">Queue: #${b.queue_number} | Wait: ${b.estimated_wait_time_minutes}m</div>
                    </div>
                    <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-bold uppercase">${b.status}</span>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p class="error-text">Failed to load bookings.</p>';
    }
}

async function handleAddWash(e) {
    e.preventDefault();
    const errorEl = document.getElementById('add-wash-error');
    const successEl = document.getElementById('add-wash-success');
    errorEl.innerText = '';
    successEl.innerText = 'Listing car wash...';

    const payload = {
        name: document.getElementById('wash-name').value,
        location: document.getElementById('wash-location').value,
        slot_capacity: parseInt(document.getElementById('wash-capacity').value),
        rating: 5.0,
        services: [{
            name: document.getElementById('service-name').value,
            price: parseFloat(document.getElementById('service-price').value),
            duration_minutes: parseInt(document.getElementById('service-duration').value)
        }]
    };

    try {
        const res = await fetch(`${API.wash}/car_washes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to list car wash');
        
        successEl.innerText = 'Car Wash successfully listed!';
        document.getElementById('add-wash-form').reset();
        
        // Refresh car washes list in the background
        fetchCarWashes();
    } catch (err) {
        successEl.innerText = '';
        errorEl.innerText = err.message;
    }
}

async function fetchAdminBookings() {
    const list = document.getElementById('admin-bookings-list');
    if (!list) return;
    list.innerHTML = '<div class="loader">Loading customer bookings...</div>';
    
    try {
        const res = await fetch(`${API.booking}/bookings/admin/all`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const bookings = await res.json();
        
        if (bookings.length === 0) {
            list.innerHTML = '<p>No customer bookings found.</p>';
            return;
        }

        list.innerHTML = bookings.map(b => `
            <li class="p-4 bg-white/5 rounded-xl mb-3 border border-white/5">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
                    <div style="flex:1;">
                        <strong class="text-white">${b.service_name}</strong>
                        <div style="font-size: 0.8rem;" class="text-slate-500">Queue: #${b.queue_number} | Wait: ${b.estimated_wait_time_minutes}m</div>
                        <div style="font-size: 0.8rem;" class="text-slate-600">User ID: ${b.user_id.substring(0,8)}...</div>
                    </div>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                        <span class="px-2 py-1 bg-white/10 rounded text-[10px] text-white font-bold">${b.status.toUpperCase()}</span>
                        <select onchange="updateBookingStatus('${b.id}', this.value)" style="margin-bottom:0; width:120px; padding:0.4rem; background:rgba(0,0,0,0.5); color:white;">
                            <option value="">Update...</option>
                            <option value="pending">Pending</option>
                            <option value="started">Started</option>
                            <option value="washing">Washing</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p class="error-text">Failed to load bookings.</p>';
    }
}

async function updateBookingStatus(bookingId, status) {
    if (!status) return;
    try {
        await fetch(`${API.booking}/bookings/${bookingId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status })
        });
        fetchAdminBookings(); // Refresh list
    } catch (err) {
        alert("Failed to update status: " + err.message);
    }
}

async function fetchMyNotifications() {
    const list = document.getElementById('notifications-list');
    if (!list) return;
    list.innerHTML = '<div class="loader">Loading notifications...</div>';
    
    try {
        const res = await fetch(`${API.notification}/notifications/my?user_id=${currentUser.id}`);
        const notifs = await res.json();
        
        if (notifs.length === 0) {
            list.innerHTML = '<p>You have no notifications yet.</p>';
            return;
        }

        list.innerHTML = notifs.map(n => `
            <li class="p-4 bg-white/5 rounded-xl mb-3 border border-white/5">
                <div style="display: flex; flex-direction: column;">
                    <strong class="text-emerald-500 text-xs font-bold uppercase">${n.type}</strong>
                    <div class="text-slate-300 mt-1">${n.message}</div>
                    <div class="text-[10px] text-slate-600 mt-2">${new Date(n.created_at).toLocaleString()}</div>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = '<p class="error-text">Failed to load notifications.</p>';
    }
}
