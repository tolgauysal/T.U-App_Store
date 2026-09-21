const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY"; // Burayı EmailJS public key ile değiştirin
const EMAILJS_SERVICE_ID = "service_hz7q51g";
const EMAILJS_TEMPLATE_ID = "template_kov6opk";

let currentUserId = localStorage.getItem('currentUserId') || '';

document.addEventListener("DOMContentLoaded", function() {
    jsonVerileriniYukle();
    initEmailJS();
});

function initEmailJS() {
    if (window.emailjs) {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
}

function goToProfilePanel() {
    if (currentUserId) {
        window.location.href = 'profile.aspx';
        return;
    }
    const panel = document.getElementById('hesapBolumu');
    if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* Authentication modal functions */
function openAuthModal(mode = 'login') {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
    switchAuthTab(mode);
}

function closeAuthModal() {
    const modal = document.getElementById('authModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
}

function switchAuthTab(tab) {
    const login = document.getElementById('authLogin');
    const register = document.getElementById('authRegister');
    const tabLogin = document.getElementById('authTabLogin');
    const tabRegister = document.getElementById('authTabRegister');
    if (tab === 'login') {
        login.style.display = 'block'; register.style.display = 'none';
        tabLogin.classList.add('active'); tabRegister.classList.remove('active');
    } else {
        login.style.display = 'none'; register.style.display = 'block';
        tabLogin.classList.remove('active'); tabRegister.classList.add('active');
    }
}

async function modalLogin() {
    const email = document.getElementById('modalLoginEmail').value.trim();
    const password = document.getElementById('modalLoginPassword').value;
    const status = document.getElementById('modalLoginStatus');
    status.textContent = 'Giriş yapılıyor...';
    try {
        const response = await fetch('http://localhost:3000/api/login', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) });
        const data = await response.json();
        status.textContent = data.message;
            if (data.success && data.userId) {
                currentUserId = data.userId;
                localStorage.setItem('currentUserId', currentUserId);
                localStorage.setItem('aktifKullanici', data.name || email);
                
                kullaniciKontrol();
                setTimeout(closeAuthModal, 400);
                window.location.href = 'profile.aspx';
            }
        } catch (error) {
            status.textContent = 'Giriş sırasında hata oluştu.';
        }
}

async function modalRegister() {
    const name = document.getElementById('modalRegisterName').value.trim();
    const nickname = document.getElementById('registerNickname') ? document.getElementById('registerNickname').value.trim() : '';
    const email = document.getElementById('modalRegisterEmail').value.trim();
    const password = document.getElementById('modalRegisterPassword').value;
    const status = document.getElementById('modalRegisterStatus');
    status.textContent = 'Kayıt yapılıyor...';
    try {
            const response = await fetch('http://localhost:3000/api/register', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, email, password, nickname }) });
        const data = await response.json();
        status.textContent = data.message;
        if (data.success && data.userId) {
            localStorage.setItem('aktifKullanici', name || email);
            currentUserId = data.userId;
            localStorage.setItem('currentUserId', currentUserId);
            kullaniciKontrol();
            setTimeout(closeAuthModal, 400);
            window.location.href = 'profile.aspx';
        }
    } catch (err) {
        status.textContent = 'Kayıt sırasında hata oluştu.';
    }
}
function openAddAppModal() {
    const modal = document.getElementById('addAppModal');
    if (!modal) return;
    modal.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden';
}
function closeAddAppModal() { const modal = document.getElementById('addAppModal'); if (!modal) return; modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

async function loadApps() {
    try {
        const res = await fetch('http://localhost:3000/api/apps');
        const data = await res.json();
        if (data.success) renderApps(data.apps || []);
    } catch (e) { console.error(e); }
}

function renderApps(apps) {
    const list = document.getElementById('uygulamaListesi');
    if (!list) return;
    list.innerHTML = '';
    (apps || []).forEach(a => {
        const el = document.createElement('a');
        el.className='uygulama-karti';
        const title = sanitizeInput(a.title || '');
        const description = sanitizeInput(a.description || '');
        const category = sanitizeInput(a.category || '');
        const author = sanitizeInput(a.author || '');
        const platform = sanitizeInput(a.platform || 'Android');
        const searchText = `${title} ${description} ${category} ${author} ${platform}`.toLowerCase();
        el.dataset.search = searchText;
        const slug = `${a.title || 'uygulama'}`
            .toLocaleLowerCase('tr-TR')
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/ı/g, 'i')
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
        el.href = `${getSiteBasePath()}/app/${slug}/${encodeURIComponent(a.id)}`;
        el.innerHTML = `
            ${a.logoUrl ? `<img class="app-logo" src="${resolveAssetUrl(a.logoUrl)}" alt="${sanitizeInput(a.title)} logosu">` : ''}
            <h3>${title}</h3>
            <p>${description}</p>
            <small>${platform} · ${author} | ${category}</small>
            <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px;">
                <span style="font-size: 18px; font-weight: bold; color: #667eea;">${a.price === 0 ? 'Ücretsiz' : `₺${(a.price ?? 9.99).toFixed(2)}`}</span>
                <span class="app-open-label">${a.status === 'coming-soon' ? 'Yakında yayınla' : 'Detayı aç →'}</span>
            </div>
        `;
        list.appendChild(el);
    });
}

async function addApplication() {
    const title = document.getElementById('appTitle').value.trim();
    const category = document.getElementById('appCategory').value.trim();
    const author = document.getElementById('appAuthor').value.trim() || localStorage.getItem('aktifKullanici') || 'Anonim';
    const downloadUrl = document.getElementById('appDownload').value.trim();
    const appFile = document.getElementById('appFile').files[0];
    const description = document.getElementById('appDescription').value.trim();
    const status = document.getElementById('addAppStatus');
    try {
        const res = await fetch('http://localhost:3000/api/apps', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title, category, author, downloadUrl, description, userId: currentUserId }) });
        const data = await res.json();
        status.textContent = data.message || '';
        if (data.success) {
            if (appFile && data.app?.id) {
                const formData = new FormData();
                formData.append('file', appFile);
                formData.append('userId', currentUserId);
                const uploadResponse = await fetch(`http://localhost:3000/api/apps/${data.app.id}/upload`, {
                    method: 'POST',
                    body: formData
                });
                const uploadData = await uploadResponse.json();
                status.textContent = uploadData.message || data.message;
                if (!uploadData.success) return;
            }
            closeAddAppModal();
            loadApps();
        }
    } catch (e) { status.textContent = 'Uygulama eklenirken hata oluştu.'; }
}

// load apps on DOM ready
document.addEventListener('DOMContentLoaded', function() { loadApps(); });

function connectProfileStream() {
    if (!currentUserId || !window.EventSource) return;
    const source = new EventSource(`http://localhost:3000/api/profile/stream/${currentUserId}`);
    source.addEventListener('profileUpdate', (event) => {
        const data = JSON.parse(event.data);
        document.getElementById('profileBio').value = data.bio || '';
        document.getElementById('profileBackupEmail').value = data.backupEmail || '';
        document.getElementById('profileAvatar').value = data.avatar || '';
        const status = document.getElementById('profileStatus');
        if (status) status.textContent = 'Profil gerçek zamanlı olarak güncellendi.';
    });
    source.onerror = () => source.close();
}

function updateProfileAvatarDisplay(name, avatarUrl) {
    const avatarEl = document.getElementById('avatarHarf');
    if (!avatarEl) return;
    const displayName = name || localStorage.getItem('aktifKullanici') || '';
    if (avatarUrl) {
        avatarEl.style.backgroundImage = `url(${avatarUrl})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.textContent = '';
    } else {
        avatarEl.style.backgroundImage = '';
        const initials = displayName.split(' ').map(p => p.charAt(0)).filter(Boolean).slice(0,2).join('').toUpperCase();
        avatarEl.textContent = initials || 'U';
    }
}

function getSiteBasePath() {
    const pathname = window.location.pathname || '/';
    return pathname.includes('/T.U-App_Store/') ? '/T.U-App_Store' : '';
}

function resolveAssetUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url) || /^data:/i.test(url) || /^mailto:/i.test(url)) return url;
    const normalizedPath = String(url).replace(/^\/+/, '');
    return `${getSiteBasePath()}/${normalizedPath}`;
}

function sanitizeInput(input) {
            const temp = document.createElement('div');
            temp.textContent = input;
            return temp.innerHTML;
        }

        async function jsonVerileriniYukle() {
            try {
                const response = await fetch('script/developer.json');
                if (!response.ok) {
                    throw new Error('JSON dosyası yüklenemedi.');
                }
                const data = await response.json();

                const storeName = sanitizeInput(data.storeName);
                const devName = sanitizeInput(data.developer.name);
                const devRole = sanitizeInput(data.developer.role);
                const devEmail = sanitizeInput(data.developer.email);
                const devGithub = sanitizeInput(data.developer.github);
                const siteYear = sanitizeInput(data.siteSettings.lastUpdate);

                const setText = (id, value) => {
                    const element = document.getElementById(id);
                    if (element) element.textContent = value;
                };
                setText("siteTitle", `${storeName} - En Yeni Uygulama ve Oyunlar`);
                setText("logoText", storeName);
                setText("welcomeHeading", `${storeName}'a Hoş Geldiniz`);
                setText("devText", `Bir yazılımcı mısınız? Geliştirdiğiniz uygulamaları veya oyunları ${storeName} üzerinde binlerce kullanıcıya ulaştırmak için ${devName} (${devRole}) ile sol taraftaki form üzerinden iletişime geçebilirsiniz.`);
                setText("devEmail", devEmail);
                const githubLink = document.getElementById("githubLink");
                if (githubLink) githubLink.href = devGithub;
                setText("footerCopyright", `© ${siteYear} ${storeName}. Tüm hakları saklıdır.`);

            } catch (error) {
                console.error("JSON verisi yüklenirken hata oluştu:", error);
                document.getElementById("logoText").textContent = "T.U App Store";
            }
        }

        function kullaniciKontrol() {
            let aktifKullanici = localStorage.getItem("aktifKullanici");
            const girisBtn = document.getElementById("girisBtn");
            const kayitBtn = document.getElementById("kayitBtn");
            const profilSekmesi = document.getElementById("profilSekmesi");
            const kullaniciAdiSpan = document.getElementById("kullaniciAdi");
            const avatarHarf = document.getElementById("avatarHarf");

            if (aktifKullanici) {
                aktifKullanici = sanitizeInput(aktifKullanici);
                girisBtn.style.display = "none";
                kayitBtn.style.display = "none";
                profilSekmesi.style.display = "flex";
                kullaniciAdiSpan.textContent = aktifKullanici;
                avatarHarf.textContent = aktifKullanici.charAt(0).toUpperCase();
                
            } else {
                girisBtn.style.display = "inline-block";
                kayitBtn.style.display = "inline-block";
                profilSekmesi.style.display = "none";
            }
        }

        function cikisYap() {
            localStorage.removeItem("aktifKullanici");
            localStorage.removeItem("currentUserId");
            kullaniciKontrol();
            window.location.reload();
        }

        function aramaYap(deger) {
            const aramaKelimesi = String(deger || '').toLowerCase().trim();
            const kartlar = document.querySelectorAll('.uygulama-karti');

            kartlar.forEach(kart => {
                const aramaMetni = (kart.dataset.search || '').toLowerCase();
                const eslesme = !aramaKelimesi || aramaMetni.includes(aramaKelimesi);
                kart.style.display = eslesme ? 'flex' : 'none';
            });
        }

        function formGuvenlikKontrol() {
            const botAlani = document.getElementById("hidden_bot_check").value;
            if (botAlani !== "") {
                console.warn("Spam Bot Algılandı!");
                return false;
            }
            return true;
        }

        async function handleContactSubmit(event) {
            event.preventDefault();
            if (!formGuvenlikKontrol()) {
                return false;
            }

            const form = document.getElementById("contactForm");
            const status = document.getElementById("formStatus");
            const submitButton = form.querySelector("button[type='submit']") || null;

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = "Gönderiliyor...";
            }

            const templateParams = {
                from_name: document.getElementById("name").value,
                from_email: document.getElementById("email").value,
                message: document.getElementById("message").value
            };

            try {
                if (window.emailjs && window.emailjs.send) {
                    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams);
                    status.textContent = "Mesajınız başarıyla gönderildi.";
                    form.reset();
                } else {
                    status.textContent = "E-posta servisi henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.";
                }
            } catch (error) {
                console.error(error);
                status.textContent = "Mesaj gönderilirken bir sorun oluştu.";
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = "Gönder";
                }
            }

            return false;
        }

        async function registerUser() {
                    const name = document.getElementById('registerName').value.trim();
                    const nickname = document.getElementById('registerNickname').value.trim();
            const email = document.getElementById('registerEmail').value.trim();
            const password = document.getElementById('registerPassword').value;
            const status = document.getElementById('registerStatus');
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password, nickname })
            });
            const data = await response.json();
            status.textContent = data.message;
            if (data.success) {
                localStorage.setItem('aktifKullanici', name || email);
                currentUserId = data.userId || currentUserId;
                localStorage.setItem('currentUserId', currentUserId);
                kullaniciKontrol();
                goToProfilePanel();
            }
        }

        async function loginUser() {
            const email = document.getElementById('loginEmail').value.trim();
            const password = document.getElementById('loginPassword').value;
            const status = document.getElementById('loginStatus');
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password })
            });
            const data = await response.json();
            status.textContent = data.message;
            if (data.success && data.userId) {
                currentUserId = data.userId;
                localStorage.setItem('currentUserId', currentUserId);
                localStorage.setItem('aktifKullanici', data.name || email);
                kullaniciKontrol();
                connectProfileStream();
                await loadCurrentUserProfile();
            }
        }

        async function loadCurrentUserProfile() {
            if (!currentUserId) return;
            const status = document.getElementById('profileStatus');
            try {
                const response = await fetch(`http://localhost:3000/api/user/${currentUserId}`);
                const data = await response.json();
                if (data.success) {
                                document.getElementById('profileNickname').value = data.user.nickname || '';
                                document.getElementById('profileBio').value = data.user.profile?.bio || '';
                                document.getElementById('profileBackupEmail').value = data.user.profile?.backupEmail || '';
                                document.getElementById('profileAvatar').value = data.user.profile?.avatar || '';
                    updateProfileAvatarDisplay(data.user.name, data.user.profile?.avatar || '');
                    status.textContent = 'Profil yüklendi.';
                                // show add-app button if user is developer
                                const addBtn = document.getElementById('addAppBtn');
                                if (addBtn) addBtn.style.display = data.user.developer ? 'inline-block' : 'none';
                }
            } catch (error) {
                status.textContent = 'Profil yüklenirken hata oluştu.';
            }
        }

        async function verifyCode() {
            const code = document.getElementById('verifyCode').value.trim();
            const status = document.getElementById('verifyStatus');
            const response = await fetch('http://localhost:3000/api/verify', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId, code })
            });
            const data = await response.json();
            status.textContent = data.message;
        }

        async function verifyTwoFactor() {
            const code = document.getElementById('verifyCode').value.trim();
            const status = document.getElementById('verifyStatus');
            const response = await fetch('http://localhost:3000/api/2fa', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId, code })
            });
            const data = await response.json();
            status.textContent = data.message;
        }

        async function saveProfile() {
            const bio = document.getElementById('profileBio').value.trim();
            const backupEmail = document.getElementById('profileBackupEmail').value.trim();
            const avatar = document.getElementById('profileAvatar').value.trim();
            const nickname = document.getElementById('profileNickname') ? document.getElementById('profileNickname').value.trim() : '';
            const status = document.getElementById('profileStatus');
            const response = await fetch('http://localhost:3000/api/profile', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId, bio, backupEmail, avatar, nickname })
            });
            const data = await response.json();
            status.textContent = data.message;
            if (data.success) updateProfileAvatarDisplay(localStorage.getItem('aktifKullanici'), avatar);
        }

        async function changePassword() {
            const oldPassword = prompt('Eski parolanızı girin:');
            const newPassword = prompt('Yeni parolanızı girin:');
            const status = document.getElementById('profileStatus');
            const response = await fetch('http://localhost:3000/api/password', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId, oldPassword, newPassword })
            });
            const data = await response.json();
            status.textContent = data.message;
        }

        async function openDeveloperAccount() {
            const status = document.getElementById('verifyStatus');
            const response = await fetch('http://localhost:3000/api/developer', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: currentUserId })
            });
            const data = await response.json();
            status.textContent = data.message;
            if (data.success) {
                const addBtn = document.getElementById('addAppBtn'); if (addBtn) addBtn.style.display = 'inline-block';
            }
        }

        async function generateGeminiText() {
            const prompt = document.getElementById("geminiPrompt").value.trim();
            const output = document.getElementById("geminiOutput");
            if (!prompt) {
                output.textContent = "Lütfen Gemini için bir metin veya istek yazın.";
                return;
            }

            output.textContent = "Gemini yanıtı oluşturuluyor...";
            try {
                const geminiApiKey = '';
                if (!geminiApiKey) {
                    output.textContent = 'Gemini API anahtarı ayarlanmamış. Lütfen güvenli bir anahtarı ortam değişkeni veya ayar dosyası üzerinden ekleyin.';
                    return;
                }

                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: `Sen T.U App Store için kısa, profesyonel ve kullanıcı odaklı bir açıklama üret. İstek: ${prompt}` }] }]
                    })
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error?.message || 'Gemini isteği başarısız oldu.');
                }

                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Yanıt alınamadı.';
                output.textContent = text;
            } catch (error) {
                console.error(error);
                output.textContent = `Gemini hatası: ${error.message}`;
            }
        }

        function openGeminiHelp() {
            const panel = document.getElementById('geminiHelpPanel');
            if (!panel) return;
            panel.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function closeGeminiHelp() {
            const panel = document.getElementById('geminiHelpPanel');
            if (!panel) return;
            panel.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
                closeGeminiHelp();
            }
        });

        async function scanAppWithVirusTotal() {
            const fileInput = document.getElementById("appFile");
            const output = document.getElementById("virusOutput");
            if (!fileInput.files.length) {
                output.textContent = "Lütfen bir APK, EXE veya ZIP dosyası seçin.";
                return;
            }

            const file = fileInput.files[0];
            output.textContent = "VirusTotal taraması başlatılıyor...";
            try {
                const formData = new FormData();
                formData.append('file', file);

                const response = await fetch('https://www.virustotal.com/api/v3/files', {
                    method: 'POST',
                    headers: { 'x-apikey': '89fb7d31ae96d1bddaa99b03e7af8fd952d4680ced46f28dfe32f71087147813' },
                    body: formData
                });

                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.error?.message || 'VirusTotal isteği başarısız oldu.');
                }

                const id = data.data?.id;
                output.textContent = `Dosya yüklendi. Analiz ID: ${id}. VirusTotal sonuçlarını inceleyin.`;
            } catch (error) {
                console.error(error);
                output.textContent = `VirusTotal hatası: ${error.message}`;
            }
        }
        