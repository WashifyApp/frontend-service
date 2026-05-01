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
    // Initialize AOS Animation Library
    AOS.init({
        once: true,
        offset: 50,
        duration: 800,
        easing: 'ease-out-cubic'
    });

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
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    const activeLink = document.getElementById(`link-${pageId}`);
    if (activeLink) activeLink.classList.add('active');
    
    // Switch Page
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const targetPage = document.getElementById(`page-${pageId}`);
    if (targetPage) targetPage.classList.add('active');
    
    // Close mobile menu if open
    const nav = document.querySelector('nav');
    if(nav) nav.classList.remove('mobile-active');

    // Page-specific logic
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
    
    // Re-trigger AOS animations for the new page
    AOS.refresh();
}

function toggleMobileMenu() {
    document.querySelector('nav').classList.toggle('mobile-active');
}

function toggleFaq(element) {
    const item = element.parentElement;
    item.classList.toggle('active');
}

async function handleContactSubmit(e) {
    e.preventDefault();
    document.getElementById('contact-success').style.display = 'block';
    e.target.reset();
    setTimeout(() => {
        document.getElementById('contact-success').style.display = 'none';
    }, 5000);
}

// Auth UI
function showAuth(mode) {
    currentAuthMode = mode;
    document.getElementById('auth-title').innerText = mode === 'login' ? 'Welcome Back' : 'Create Account';
    document.getElementById('auth-subtitle').innerText = mode === 'login' ? 'Log in to access your dashboard' : 'Join the smart car wash revolution';
    document.getElementById('auth-submit').innerHTML = mode === 'login' ? 'Log In <i class="fa-solid fa-arrow-right"></i>' : 'Sign Up <i class="fa-solid fa-user-plus"></i>';
    document.querySelector('.toggle-auth').innerHTML = mode === 'login' ? "Don't have an account? <span class='text-accent'>Sign up</span>" : "Already have an account? <span class='text-accent'>Log in</span>";
    document.getElementById('auth-error').innerText = '';
    
    // Toggle role and phone fields
    document.getElementById('auth-role-group').style.display = mode === 'login' ? 'none' : 'block';
    const phoneGroup = document.getElementById('auth-phone-group');
    const phoneInput = document.getElementById('auth-phone');
    phoneGroup.style.display = mode === 'login' ? 'none' : 'block';
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
    errorEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Loading...';

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
            document.getElementById('auth-modal').style.display = 'none';
            document.getElementById('otp-modal').style.display = 'flex';
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
        errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message}`;
    }
}

async function verifyOTP(e) {
    e.preventDefault();
    const otp = document.getElementById('otp-code').value;
    const email = document.getElementById('otp-modal').dataset.email;
    const errorEl = document.getElementById('otp-error');
    errorEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
    
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
        errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message}`;
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
            grid.innerHTML = '<div class="glass-card w-100" style="text-align:center; padding: 3rem;"><i class="fa-solid fa-store-slash text-muted" style="font-size:3rem; margin-bottom:1rem;"></i><p>No premium washes available at the moment.</p></div>';
            return;
        }

        grid.innerHTML = washes.map((w, index) => `
            <div class="wash-card glass-card" data-aos="fade-up" data-aos-delay="${index * 100}">
                <div class="wash-header">
                    <div>
                        <h3 class="wash-title">${w.name}</h3>
                        <p class="wash-location"><i class="fa-solid fa-location-dot"></i> ${w.location}</p>
                    </div>
                    <div class="wash-rating"><i class="fa-solid fa-star"></i> ${w.rating}</div>
                </div>
                <div class="services-list">
                    ${w.services.map(s => `
                    <div class="service-item">
                        <span class="service-name"><i class="fa-solid fa-check text-emerald" style="margin-right: 8px;"></i>${s.name}</span>
                        <div class="service-meta">
                            <span class="service-duration"><i class="fa-regular fa-clock"></i> ${s.duration_minutes}m</span>
                            <span class="service-price">$${s.price}</span>
                        </div>
                    </div>`).join('')}
                </div>
                ${(!currentUser || currentUser.role !== 'admin') ? 
                  `<button class="btn-primary w-100" onclick='openBooking(${JSON.stringify(w)})'>Book This Wash <i class="fa-solid fa-arrow-right"></i></button>` 
                  : '<p style="color:var(--text-muted); font-size:0.85rem; text-align:center; margin-top:1rem;"><i class="fa-solid fa-circle-info"></i> Admins cannot book services.</p>'}
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<div class="glass-card w-100" style="text-align:center; padding: 3rem;"><i class="fa-solid fa-triangle-exclamation text-accent" style="font-size:3rem; margin-bottom:1rem;"></i><p class="error-text">Failed to load car washes. Ensure backend is running.</p></div>';
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
    successEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Processing booking...';

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
        
        successEl.innerHTML = `<i class="fa-solid fa-check-circle"></i> Booking confirmed! Queue number is #${data.queue_number}. Est wait: ${data.estimated_wait_time_minutes} mins.`;
        setTimeout(() => {
            closeModals();
            showPage('dashboard');
        }, 3000);
    } catch (err) {
        successEl.innerText = '';
        errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message}`;
    }
}

async function fetchMyBookings() {
    const list = document.getElementById('bookings-list');
    if (!list) return;
    list.innerHTML = '<div class="loader-container"><div class="spinner"></div><p>Loading bookings...</p></div>';
    
    try {
        const res = await fetch(`${API.booking}/bookings/my`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const bookings = await res.json();
        
        if (bookings.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding: 2rem; text-align: center;"><i class="fa-regular fa-calendar-xmark" style="font-size: 2rem; margin-bottom: 1rem; display:block;"></i> You have no bookings yet.</p>';
            return;
        }

        list.innerHTML = bookings.map(b => `
            <li class="booking-item">
                <div class="booking-header">
                    <span class="booking-service">${b.service_name}</span>
                    <span class="status-badge status-${b.status.toLowerCase()}">${b.status}</span>
                </div>
                <div class="booking-meta">
                    <span><i class="fa-solid fa-hashtag"></i> Queue: #${b.queue_number}</span>
                    <span><i class="fa-regular fa-clock"></i> Wait: ${b.estimated_wait_time_minutes}m</span>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="error-text" style="padding: 1rem;"><i class="fa-solid fa-circle-exclamation"></i> Failed to load bookings.</p>`;
    }
}

async function handleAddWash(e) {
    e.preventDefault();
    const errorEl = document.getElementById('add-wash-error');
    const successEl = document.getElementById('add-wash-success');
    errorEl.innerText = '';
    successEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Listing car wash...';

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
        
        successEl.innerHTML = '<i class="fa-solid fa-check-circle"></i> Car Wash successfully listed!';
        document.getElementById('add-wash-form').reset();
        
        // Refresh car washes list in the background
        fetchCarWashes();
    } catch (err) {
        successEl.innerText = '';
        errorEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${err.message}`;
    }
}

async function fetchAdminBookings() {
    const list = document.getElementById('admin-bookings-list');
    if (!list) return;
    list.innerHTML = '<div class="loader-container"><div class="spinner"></div><p>Loading customer bookings...</p></div>';
    
    try {
        const res = await fetch(`${API.booking}/bookings/admin/all`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const bookings = await res.json();
        
        if (bookings.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding: 2rem; text-align: center;"><i class="fa-solid fa-inbox" style="font-size: 2rem; margin-bottom: 1rem; display:block;"></i> No customer bookings found.</p>';
            return;
        }

        list.innerHTML = bookings.map(b => `
            <li class="booking-item">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                    <div style="flex:1;">
                        <div class="booking-service">${b.service_name}</div>
                        <div class="booking-meta" style="margin-top: 0.5rem;">
                            <span><i class="fa-solid fa-hashtag"></i> Q: #${b.queue_number}</span>
                            <span><i class="fa-regular fa-clock"></i> Wait: ${b.estimated_wait_time_minutes}m</span>
                            <span><i class="fa-solid fa-user"></i> ID: ${b.user_id.substring(0,8)}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 0.5rem; align-items:center;">
                        <span class="status-badge status-${b.status.toLowerCase()}">${b.status}</span>
                        <select onchange="updateBookingStatus('${b.id}', this.value)" style="margin-bottom:0; width:140px; padding:0.5rem; background:rgba(0,0,0,0.5); color:white;">
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
        list.innerHTML = `<p class="error-text" style="padding: 1rem;"><i class="fa-solid fa-circle-exclamation"></i> Failed to load bookings.</p>`;
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
    list.innerHTML = '<div class="loader-container"><div class="spinner"></div><p>Loading notifications...</p></div>';
    
    try {
        const res = await fetch(`${API.notification}/notifications/my?user_id=${currentUser.id}`);
        const notifs = await res.json();
        
        if (notifs.length === 0) {
            list.innerHTML = '<p class="text-muted" style="padding: 2rem; text-align: center;"><i class="fa-regular fa-bell-slash" style="font-size: 2rem; margin-bottom: 1rem; display:block;"></i> You have no notifications yet.</p>';
            return;
        }

        list.innerHTML = notifs.map(n => `
            <li class="notification-item">
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <div class="stat-icon" style="width: 32px; height: 32px; font-size: 1rem; flex-shrink: 0;"><i class="fa-solid fa-bell"></i></div>
                    <div>
                        <strong class="text-emerald text-xs uppercase" style="letter-spacing: 1px;">${n.type}</strong>
                        <div class="text-light mt-1" style="margin-top: 0.2rem;">${n.message}</div>
                        <div class="text-muted" style="font-size: 0.8rem; margin-top: 0.4rem;"><i class="fa-regular fa-calendar"></i> ${new Date(n.created_at).toLocaleString()}</div>
                    </div>
                </div>
            </li>
        `).join('');
    } catch (err) {
        list.innerHTML = `<p class="error-text" style="padding: 1rem;"><i class="fa-solid fa-circle-exclamation"></i> Failed to load notifications.</p>`;
    }
}
