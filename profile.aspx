<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Profil - T.U App Store</title>
  <link rel="stylesheet" href="css/index.css">
</head>
<body>
  <header>
    <h1>Profil Sayfası</h1>
    <a href="index.html">Anasayfa</a>
  </header>
  <main style="max-width:900px;margin:24px auto;">
    <section id="profileCard">
      <div style="display:flex;gap:16px;align-items:center;">
        <div id="profileAvatarBig" style="width:96px;height:96px;border-radius:12px;background:#ddd;display:flex;align-items:center;justify-content:center;font-size:32px;"></div>
        <div>
          <h2 id="profileName">Kullanıcı</h2>
          <p id="profileEmail">e-posta</p>
        </div>
      </div>
      <div style="margin-top:20px;">
        <label>Biyografi</label>
        <textarea id="pBio" style="width:100%;height:80px"></textarea>
        <label>Avatar URL</label>
        <input id="pAvatar" style="width:100%" />
        <label>Yedek E-posta</label>
        <input id="pBackup" style="width:100%" />
        <div style="margin-top:12px;display:flex;gap:8px;">
          <button onclick="saveProfileFromPage()" class="btn satinal-btn">Profili Kaydet</button>
          <button onclick="openDeveloper()" class="btn giris-btn">Geliştirici Ol</button>
          <button onclick="changePasswordPrompt()" class="btn">Parolayı Değiştir</button>
          <button onclick="deleteAccount()" class="btn cikis-btn">Hesabı Sil</button>
        </div>
        <div id="pageStatus" class="sonuc-alani"></div>
      </div>
    </section>
  </main>

  <script>
    const currentUserId = localStorage.getItem('currentUserId') || '';
    if (!currentUserId) { alert('Oturum açılmamış. Giriş yapınız.'); location.href='index.html'; }

    async function loadProfilePage() {
      try {
        const res = await fetch(`/api/user/${currentUserId}`);
        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Hata');
        const user = data.user;
        document.getElementById('profileName').textContent = user.name || 'Kullanıcı';
        document.getElementById('profileEmail').textContent = user.email || '';
        document.getElementById('pBio').value = user.profile?.bio || '';
        document.getElementById('pAvatar').value = user.profile?.avatar || '';
        document.getElementById('pBackup').value = user.profile?.backupEmail || '';
        updateBigAvatar(user.name, user.profile?.avatar || '');
      } catch (e) {
        document.getElementById('pageStatus').textContent = 'Profil yüklenemedi.';
      }
    }

    function updateBigAvatar(name, avatar) {
      const el = document.getElementById('profileAvatarBig');
      if (avatar) {
        el.style.backgroundImage = `url(${avatar})`;
        el.style.backgroundSize = 'cover'; el.textContent='';
      } else {
        el.style.backgroundImage='';
        const initials = (name||'').split(' ').map(p=>p.charAt(0)).filter(Boolean).slice(0,2).join('').toUpperCase();
        el.textContent = initials || 'U';
      }
    }

    async function saveProfileFromPage() {
      const bio = document.getElementById('pBio').value;
      const avatar = document.getElementById('pAvatar').value;
      const backup = document.getElementById('pBackup').value;
      const status = document.getElementById('pageStatus');
      status.textContent = 'Kaydediliyor...';
      try {
        const res = await fetch('/api/profile', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUserId, bio, backupEmail: backup, avatar }) });
        const data = await res.json();
        status.textContent = data.message;
        updateBigAvatar(document.getElementById('profileName').textContent, avatar);
      } catch (e) { status.textContent = 'Kaydetme hatası.' }
    }

    async function openDeveloper() {
      const status = document.getElementById('pageStatus');
      const res = await fetch('/api/developer', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUserId }) });
      const data = await res.json();
      status.textContent = data.message || '';
    }

    async function changePasswordPrompt() {
      const oldP = prompt('Eski parolanızı girin:');
      if (!oldP) return;
      const newP = prompt('Yeni parolanızı girin:');
      if (!newP) return;
      const res = await fetch('/api/password', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUserId, oldPassword: oldP, newPassword: newP }) });
      const data = await res.json();
      document.getElementById('pageStatus').textContent = data.message || '';
    }

    async function deleteAccount() {
      if (!confirm('Hesabınızı kalıcı olarak silmek istediğinizden emin misiniz?')) return;
      const res = await fetch('/api/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId: currentUserId }) });
      const data = await res.json();
      if (data.success) {
        localStorage.removeItem('currentUserId');
        localStorage.removeItem('aktifKullanici');
        alert('Hesabınız silindi.');
        location.href='index.html';
      } else {
        document.getElementById('pageStatus').textContent = data.message || 'Silme hatası.';
      }
    }

    loadProfilePage();
  </script>
</body>
</html>
