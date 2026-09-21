function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = value ?? '';
    return element.innerHTML;
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

function getAppId() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    return decodeURIComponent(segments.at(-1) || '');
}

async function loadAppDetail() {
    const container = document.getElementById('appDetail');
    const appId = getAppId();

    try {
        const response = await fetch(`http://localhost:3000/api/apps`);
        const data = await response.json();
        const app = data.apps?.find((item) => item.id === appId);
        if (!response.ok || !app) throw new Error('Uygulama bulunamadı.');

        document.title = `${app.title} | T.U App Store`;
        const downloadMarkup = app.status === 'coming-soon'
            ? '<button class="download-button is-disabled" type="button" disabled>Yakında yayınla</button>'
            : app.downloadUrl
            ? `<a class="download-button" href="${escapeHtml(resolveAssetUrl(app.downloadUrl))}" download>Uygulamayı indir</a>`
            : '<button class="download-button is-disabled" type="button" disabled>Dosya bekleniyor</button>';

        container.innerHTML = `
            <div class="app-detail-card">
                ${app.logoUrl ? `<img class="app-detail-logo" src="${resolveAssetUrl(app.logoUrl)}" alt="${escapeHtml(app.title)} logosu">` : ''}
                <span class="app-kicker">${escapeHtml(app.platform || 'Android')} · ${escapeHtml(app.category || 'Uygulama')}</span>
                <h1>${escapeHtml(app.title)}</h1>
                <p class="app-description">${escapeHtml(app.description || 'Bu uygulama için açıklama eklenmemiş.')}</p>
                <dl class="app-meta">
                    <div><dt>Geliştirici</dt><dd>${escapeHtml(app.author || 'Belirtilmemiş')}</dd></div>
                    <div><dt>Fiyat</dt><dd>${app.price === 0 ? 'Ücretsiz' : `₺${Number(app.price ?? 9.99).toFixed(2)}`}</dd></div>
                </dl>
                ${downloadMarkup}
            </div>
        `;
    } catch (error) {
        container.innerHTML = `
            <div class="app-detail-card error-state">
                <h1>Uygulama bulunamadı</h1>
                <p>Bu bağlantı geçersiz veya uygulama artık yayınlanmıyor.</p>
                <a class="download-button" href="/">Mağazaya dön</a>
            </div>
        `;
    }
}

document.addEventListener('DOMContentLoaded', loadAppDetail);
