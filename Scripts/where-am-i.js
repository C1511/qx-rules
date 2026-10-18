/**
 * Where Am I — Follow Proxy IP（Quantumult X 版）
 *
 * 改自 Greasy Fork #600207「Where Am I — Follow Proxy IP」v6.6.6，原作者 Z健C。
 * 原作以 CC BY-NC-SA 4.0 发布，本改编版沿用同一协议（署名 · 非商业 · 相同方式共享）。
 *
 * 和油猴版的区别
 *   油猴版：在页面里用 GM_xmlhttpRequest 查出口 IP，每 5 秒复检。
 *   QX 版 ：在 QX 里用 $task.fetch 查出口 IP 与归属地（页面里不发任何请求），
 *           把结果直接写进注入脚本；注入后脚本标签自删，DOM 里不留痕迹。
 *           自动处理 CSP（复用页面 nonce，必要时给 script-src 追加 nonce）。
 *
 * 一个文件三种用法（按 QX 传入的对象自动区分）
 *   script-response-body   → 往 HTML 文档注入时区 / 定位补丁（主功能）
 *   script-request-header  → langMode 不为 'off' 时，同步改写 Accept-Language
 *   task / 手动运行         → 立刻重查出口，通知当前出口地理信息（切节点后用）
 *
 * 覆盖：Geolocation / Permissions、Intl.DateTimeFormat、Date（getter/setter/toString/构造器）
 * 可选：WebRTC 候选过滤（rtcProtection）、语言对齐（langMode）
 *
 * 配置：改下面 DEFAULTS，或在 QX 持久化里写 key `wai_config`（JSON，只写要改的字段）。
 */

const DEFAULTS = {
    debug: false,

    spoofGeolocation: true,
    spoofTimezone: true,
    deepDatePatch: true,          // 替换 window.Date 构造器
    stealthToString: true,        // 伪装被替换函数的 toString

    // 'off' | 'mdns' | 'rewrite' | 'filter' | 'block'，含义同油猴版
    // iOS 上没有 WebRTC Network Limiter 这类扩展，Safari 默认只给 mDNS 候选，
    // 一般保持 'off' 即可；确认有公网 IP 泄漏再改 'mdns'
    rtcProtection: 'off',

    // 'off' | 'match' | 'en'
    // QX 能改请求头，所以 'match' 在这里是完整可用的：
    // 需要同时启用 conf 里那条 script-request-header 规则，否则会出现 JS 与请求头不一致
    langMode: 'off',

    accuracyRange: [30, 80],
    jitterMeters: 60,

    ipCheckSec: 60,               // 出口 IP 复检间隔（秒）；切节点后最多这么久生效，或手动跑一次 task
    geoCacheSec: 6 * 3600,        // IP → 归属地 缓存
    fetchTimeoutMs: 2500,         // 单个查询接口超时
    policy: '',                   // 查询走的策略名；留空则按规则分流（应与目标网站同一条线路）

    cnDirectHosts: [
        '163.com', '126.com', 'alibaba.com', 'alicdn.com', 'alipay.com', 'aliyun.com',
        'amap.com', 'baidu.com', 'bilibili.com', 'biligame.com', 'bytedance.com',
        'douban.com', 'douyin.com', 'gov.cn', 'gtimg.com', 'huawei.com', 'iqiyi.com',
        'jd.com', 'kuaishou.com', 'meituan.com', 'mi.com', 'microsoftonline.cn',
        'netease.com', 'qcloud.com', 'qidian.com', 'qq.com', 'sina.com', 'sina.cn',
        'sohu.com', 'taobao.com', 'tencent.com', 'tmall.com', 'toutiao.com',
        'vip.com', 'weibo.com', 'xiaohongshu.com', 'ximalaya.com', 'youku.com',
        'zhihu.com', '12306.cn', 'alibabacloud.com', 'hichina.com', 'wps.cn',
    ],
    cnTlds: ['.cn'],
    extraDirectHosts: [],
    forceSpoofHosts: [],

    countryLangs: {
        US: ['en-US', 'en'], GB: ['en-GB', 'en'], CA: ['en-CA', 'en'], AU: ['en-AU', 'en'],
        NZ: ['en-NZ', 'en'], IE: ['en-IE', 'en'], SG: ['en-SG', 'en'], IN: ['en-IN', 'en'],
        PH: ['en-PH', 'en'], ZA: ['en-ZA', 'en'], NG: ['en-NG', 'en'], KE: ['en-KE', 'en'],
        JP: ['ja-JP', 'ja', 'en-US', 'en'], KR: ['ko-KR', 'ko', 'en-US', 'en'],
        HK: ['zh-HK', 'zh', 'en'], MO: ['zh-MO', 'zh'], TW: ['zh-TW', 'zh'],
        DE: ['de-DE', 'de', 'en'], AT: ['de-AT', 'de'], CH: ['de-CH', 'de', 'fr', 'en'],
        FR: ['fr-FR', 'fr', 'en'], BE: ['nl-BE', 'nl', 'fr', 'en'], NL: ['nl-NL', 'nl', 'en'],
        SE: ['sv-SE', 'sv', 'en'], NO: ['nb-NO', 'nb', 'en'], DK: ['da-DK', 'da', 'en'],
        FI: ['fi-FI', 'fi', 'en'], IS: ['is-IS', 'is', 'en'], IT: ['it-IT', 'it', 'en'],
        ES: ['es-ES', 'es', 'en'], PT: ['pt-PT', 'pt', 'en'], PL: ['pl-PL', 'pl', 'en'],
        CZ: ['cs-CZ', 'cs', 'en'], SK: ['sk-SK', 'sk', 'en'], HU: ['hu-HU', 'hu', 'en'],
        RO: ['ro-RO', 'ro', 'en'], BG: ['bg-BG', 'bg', 'en'], GR: ['el-GR', 'el', 'en'],
        HR: ['hr-HR', 'hr', 'en'], SI: ['sl-SI', 'sl', 'en'], LT: ['lt-LT', 'lt', 'en'],
        LV: ['lv-LV', 'lv', 'en'], EE: ['et-EE', 'et', 'en'], UA: ['uk-UA', 'uk', 'ru', 'en'],
        RU: ['ru-RU', 'ru', 'en'], TR: ['tr-TR', 'tr', 'en'], IL: ['he-IL', 'he', 'en'],
        AE: ['ar-AE', 'ar', 'en'], SA: ['ar-SA', 'ar', 'en'], EG: ['ar-EG', 'ar', 'en'],
        QA: ['ar-QA', 'ar', 'en'], KW: ['ar-KW', 'ar', 'en'], ID: ['id-ID', 'id', 'en'],
        TH: ['th-TH', 'th', 'en'], VN: ['vi-VN', 'vi', 'en'], MY: ['ms-MY', 'ms', 'en'],
        BR: ['pt-BR', 'pt', 'en'], MX: ['es-MX', 'es', 'en'], AR: ['es-AR', 'es', 'en'],
        CL: ['es-CL', 'es', 'en'], CO: ['es-CO', 'es', 'en'], PE: ['es-PE', 'es', 'en'],
        NP: ['ne-NP', 'ne', 'en'], PK: ['en-PK', 'en'], BD: ['bn-BD', 'bn', 'en'],
        LK: ['si-LK', 'si', 'en'], KZ: ['ru-KZ', 'ru', 'kk', 'en'],
    },
};

const KEY_CFG = 'wai_config';
const KEY_IP = 'wai_ip';
const KEY_GEO = 'wai_geo';

const CFG = loadConfig();
const log = (...a) => { if (CFG.debug) console.log('[WhereAmI] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };

/* ══════════════════════════════════════════════════
   入口
   ══════════════════════════════════════════════════ */
(function main() {
    const hasReq = typeof $request !== 'undefined' && $request;
    const hasResp = typeof $response !== 'undefined' && $response;
    if (hasResp) {
        onResponse().catch(e => { log('response 异常', String(e)); $done({}); });
    } else if (hasReq) {
        try { onRequest(); } catch (e) { log('request 异常', String(e)); $done({}); }
    } else {
        onTask().catch(e => { log('task 异常', String(e)); $done(); });
    }
})();

/* ══════════════════════════════════════════════════
   1. 配置 / 存储 / 网络
   ══════════════════════════════════════════════════ */
function loadConfig() {
    const cfg = JSON.parse(JSON.stringify(DEFAULTS));
    try {
        const raw = $prefs.valueForKey(KEY_CFG);
        if (raw) Object.assign(cfg, JSON.parse(raw));
    } catch (e) { /* 配置写坏了就用默认值 */ }
    return cfg;
}

function readJSON(k) {
    try { const v = $prefs.valueForKey(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function writeJSON(k, v) {
    try { $prefs.setValueForKey(JSON.stringify(v), k); } catch (e) { }
}

function withTimeout(p, ms) {
    return new Promise(resolve => {
        let done = false;
        const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
        p.then(v => { if (!done) { done = true; clearTimeout(t); resolve(v); } },
            () => { if (!done) { done = true; clearTimeout(t); resolve(null); } });
    });
}

function httpGet(url) {
    const req = { url: url, method: 'GET', headers: { 'Cache-Control': 'no-cache', 'Accept': 'application/json' } };
    if (CFG.policy) req.opts = { policy: CFG.policy };
    const p = $task.fetch(req).then(r => (r && r.statusCode >= 200 && r.statusCode < 300) ? r.body : null);
    return withTimeout(p, CFG.fetchTimeoutMs);
}

function jsonOrNull(t) { if (!t) return null; try { return JSON.parse(t); } catch (e) { return null; } }
const num = v => (typeof v === 'number' ? v : parseFloat(v));
const finite = v => typeof v === 'number' && isFinite(v);

function getHeader(h, name) {
    if (!h) return undefined;
    const n = name.toLowerCase();
    for (const k in h) if (k.toLowerCase() === n) return h[k];
    return undefined;
}
function headerKeys(h, name) {
    const n = name.toLowerCase();
    return Object.keys(h || {}).filter(k => k.toLowerCase() === n);
}

function isValidTz(tz) {
    if (!tz || typeof tz !== 'string') return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch (e) { return false; }
}

/* ══════════════════════════════════════════════════
   2. 站点判定（与油猴版一致）
   ══════════════════════════════════════════════════ */
function hostOf(url) {
    const m = /^[a-z][a-z0-9+.-]*:\/\/(?:[^@\/?#]*@)?(\[[^\]]+\]|[^:\/?#]+)/i.exec(url || '');
    return m ? m[1].toLowerCase() : '';
}
function hostMatches(h, list) {
    for (let i = 0; i < list.length; i++) {
        const d = list[i];
        if (h === d || h.endsWith('.' + d)) return true;
    }
    return false;
}
function decideActive(host) {
    if (!host) return false;
    if (hostMatches(host, CFG.forceSpoofHosts)) return true;
    if (CFG.extraDirectHosts.length && hostMatches(host, CFG.extraDirectHosts)) return false;
    if (host === 'localhost' || host.endsWith('.local')) return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.indexOf(':') > -1) return false;
    if (CFG.cnTlds.some(t => host.endsWith(t))) return false;
    if (hostMatches(host, CFG.cnDirectHosts)) return false;
    return true;
}

/* ══════════════════════════════════════════════════
   3. 出口 IP 与归属地（多源投票，逻辑同油猴版）
   ══════════════════════════════════════════════════ */
async function getExitIP() {
    const urls = ['https://api.ipify.org?format=json', 'https://api64.ipify.org?format=json'];
    for (const u of urls) {
        const d = jsonOrNull(await httpGet(u));
        if (d && d.ip) return d.ip;
    }
    return null;
}

async function srcIpWhoIs(ip) {
    const d = jsonOrNull(await httpGet('https://ipwho.is/' + encodeURIComponent(ip)));
    if (!d || !d.success || !d.country_code) return null;
    return { source: 'ipwho.is', country: d.country_code, lat: num(d.latitude), lon: num(d.longitude),
        timezone: (d.timezone && d.timezone.id) || null, rank: 1 };
}
async function srcFreeIpApi(ip) {
    const d = jsonOrNull(await httpGet('https://freeipapi.com/api/json/' + encodeURIComponent(ip)));
    if (!d || !d.countryCode || d.countryCode === '-') return null;
    return { source: 'freeipapi', country: d.countryCode, lat: num(d.latitude), lon: num(d.longitude),
        timezone: d.timeZone || null, rank: 2 };
}
async function srcIpInfo(ip) {
    const d = jsonOrNull(await httpGet('https://ipinfo.io/' + encodeURIComponent(ip) + '/json'));
    if (!d || !d.country) return null;
    const loc = (d.loc || '').split(',');
    return { source: 'ipinfo', country: d.country, lat: num(loc[0]), lon: num(loc[1]),
        timezone: d.timezone || null, rank: 3 };
}
async function srcIpApiCo(ip) {
    const d = jsonOrNull(await httpGet('https://ipapi.co/' + encodeURIComponent(ip) + '/json/'));
    if (!d || !d.country_code || d.error) return null;
    return { source: 'ipapi.co', country: d.country_code, lat: num(d.latitude), lon: num(d.longitude),
        timezone: d.timezone || null, rank: 4 };
}

function hasCoords(r) {
    return !!r && finite(r.lat) && finite(r.lon) && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180 &&
        !(r.lat === 0 && r.lon === 0);
}
function pickCoords(list) {
    const s = list.slice().sort((a, b) => a.rank - b.rank);
    for (const r of s) if (hasCoords(r)) return r;
    return null;
}
function vote(results) {
    const valid = results.filter(r => r && r.country);
    if (!valid.length) return null;
    const groups = new Map();
    valid.forEach(r => { if (!groups.has(r.country)) groups.set(r.country, []); groups.get(r.country).push(r); });
    let winners;
    if (groups.size === 1) winners = valid;
    else {
        const major = [...groups.values()].filter(a => a.length >= 2).sort((a, b) => b.length - a.length)[0];
        winners = major || [valid.find(r => r.source === 'ipwho.is') || valid.find(r => r.source === 'ipinfo') || valid[0]];
    }
    const inGroup = pickCoords(winners);
    if (inGroup) {
        const tzSrc = winners.find(r => isValidTz(r.timezone));
        const tz = isValidTz(inGroup.timezone) ? inGroup.timezone : (tzSrc && tzSrc.timezone) || null;
        return { country: winners[0].country, lat: inGroup.lat, lon: inGroup.lon, timezone: tz, source: inGroup.source };
    }
    const any = pickCoords(valid);
    if (!any) return null;
    return { country: any.country, lat: any.lat, lon: any.lon, timezone: any.timezone || null, source: any.source };
}

async function lookupGeo(ip) {
    const results = await Promise.all([
        srcIpWhoIs(ip).catch(() => null),
        srcFreeIpApi(ip).catch(() => null),
        srcIpInfo(ip).catch(() => null),
        srcIpApiCo(ip).catch(() => null),
    ]);
    const w = vote(results);
    if (!w || !isValidTz(w.timezone)) return null;
    return w;
}

// 出口 IP 每 ipCheckSec 复检；IP 不变直接用缓存的归属地
async function resolveGeo(forceIpCheck) {
    const now = Date.now();
    const rec = readJSON(KEY_IP);
    let ip = rec && rec.ip;
    if (forceIpCheck || !ip || now - (rec.ts || 0) > CFG.ipCheckSec * 1000) {
        const fresh = await getExitIP();
        if (fresh) {
            if (fresh !== ip) log('出口 IP 变化', String(ip), '→', fresh);
            ip = fresh;
            writeJSON(KEY_IP, { ip: ip, ts: now });
        }
    }
    if (!ip) return null;

    const map = readJSON(KEY_GEO) || {};
    const hit = map[ip];
    if (hit && now - (hit.ts || 0) < CFG.geoCacheSec * 1000 && isValidTz(hit.timezone)) {
        return Object.assign({ ip: ip }, hit);
    }
    const g = await lookupGeo(ip);
    if (!g) return hit && isValidTz(hit.timezone) ? Object.assign({ ip: ip }, hit) : null;
    g.ts = now;
    map[ip] = g;
    const keys = Object.keys(map).sort((a, b) => (map[b].ts || 0) - (map[a].ts || 0));
    keys.slice(20).forEach(k => delete map[k]);   // 最多留 20 个出口
    writeJSON(KEY_GEO, map);
    log('归属地', ip, g.country, g.timezone, g.source);
    return Object.assign({ ip: ip }, g);
}

function cachedGeo() {
    const rec = readJSON(KEY_IP);
    if (!rec || !rec.ip) return null;
    const map = readJSON(KEY_GEO) || {};
    return map[rec.ip] ? Object.assign({ ip: rec.ip }, map[rec.ip]) : null;
}

function langListFor(country) {
    if (CFG.langMode === 'en') return ['en-US', 'en'];
    if (CFG.langMode === 'match' && country) return CFG.countryLangs[country] || null;
    return null;
}

/* ══════════════════════════════════════════════════
   4. script-request-header：同步 Accept-Language
   ══════════════════════════════════════════════════ */
function onRequest() {
    if (CFG.langMode === 'off' || !decideActive(hostOf($request.url))) return $done({});
    const g = cachedGeo();
    const list = langListFor(g && g.country);
    if (!list) return $done({});
    const value = list.map((l, i) => i === 0 ? l : l + ';q=' + Math.max(0.1, 1 - i * 0.1).toFixed(1)).join(',');
    const headers = Object.assign({}, $request.headers);
    const keys = headerKeys(headers, 'Accept-Language');
    if (keys.length) keys.forEach(k => { headers[k] = value; });
    else headers['Accept-Language'] = value;
    $done({ headers: headers });
}

/* ══════════════════════════════════════════════════
   5. task：手动刷新（切节点后跑一次）
   ══════════════════════════════════════════════════ */
async function onTask() {
    const g = await resolveGeo(true);
    if (g) {
        $notify('Where Am I', g.ip + ' · ' + g.country,
            g.timezone + ' · ' + g.lat.toFixed(3) + ', ' + g.lon.toFixed(3) + '（' + (g.source || 'cache') + '）');
    } else {
        $notify('Where Am I', '查询失败', '检查 api.ipify.org / ipwho.is 等是否可达');
    }
    $done();
}

/* ══════════════════════════════════════════════════
   6. script-response-body：注入
   ══════════════════════════════════════════════════ */
async function onResponse() {
    const url = $request.url;
    const host = hostOf(url);
    if (!decideActive(host)) return $done({});

    const rh = $response.headers || {};
    const ct = String(getHeader(rh, 'Content-Type') || '');
    if (!/text\/html|application\/xhtml\+xml/i.test(ct)) return $done({});
    const cs = /charset\s*=\s*"?([^;"\s]+)/i.exec(ct);
    if (cs && !/^utf-?8$/i.test(cs[1])) return $done({});      // 非 UTF-8 页面不碰，避免乱码

    // 只处理顶层文档与 iframe，跳过 fetch/XHR 拿回来的 HTML 片段
    const dest = getHeader($request.headers, 'Sec-Fetch-Dest');
    if (dest && !/^(document|iframe|frame|embed|object)$/i.test(String(dest))) return $done({});

    const body = $response.body;
    if (typeof body !== 'string' || body.indexOf('<') === -1) return $done({});

    const geo = await resolveGeo(false);
    if (!geo) { log('无可用归属地，放行', host); return $done({}); }

    const plan = planCSP(rh);
    const payload = buildPayload(geo);
    const tag = '<script' + (plan.nonce ? ' nonce="' + plan.nonce + '"' : '') + '>' + payload + '</script>';
    const newBody = injectHtml(body, tag);

    log('注入', host, geo.country, geo.timezone, plan.headers ? '(已改 CSP)' : '');
    if (plan.headers) $done({ body: newBody, headers: plan.headers });
    else $done({ body: newBody });
}

function injectHtml(html, tag) {
    let m = /<head\b[^>]*>/i.exec(html);
    if (!m) m = /<html\b[^>]*>/i.exec(html);
    if (!m) m = /<!doctype[^>]*>/i.exec(html);
    if (!m) return tag + html;
    const at = m.index + m[0].length;
    return html.slice(0, at) + tag + html.slice(at);
}

/* ── CSP ──
   每条策略按「对 <script> 生效的指令」判断：script-src-elem > script-src > default-src
   · 无该指令 / 只有 'unsafe-inline'（无 nonce/hash/strict-dynamic）→ 本就允许内联，不改
   · 已有 nonce → 复用页面自己的 nonce，不改头
   · 其余（只有 hash、或只有来源白名单）→ 给该指令追加我们的 nonce
     这类策略里 'unsafe-inline' 本来就无效 / 不存在，追加 nonce 不会放宽页面自身的内联脚本 */
function planCSP(h) {
    const keys = headerKeys(h, 'Content-Security-Policy');
    if (!keys.length) return { nonce: null, headers: null };

    let nonce = null;
    keys.forEach(k => {
        const m = /'nonce-([A-Za-z0-9+\/=_-]+)'/.exec(String(h[k]));
        if (m && !nonce) nonce = m[1];
    });
    if (!nonce) nonce = randomNonce();

    let changed = false;
    const out = Object.assign({}, h);
    keys.forEach(k => {
        const policies = String(h[k]).split(',');
        const rewritten = policies.map(p => {
            const dirs = p.split(';').map(s => s.trim()).filter(Boolean).map(s => {
                const parts = s.split(/\s+/);
                return { name: parts[0].toLowerCase(), values: parts.slice(1) };
            });
            const eff = dirs.find(d => d.name === 'script-src-elem') ||
                dirs.find(d => d.name === 'script-src') ||
                dirs.find(d => d.name === 'default-src');
            if (!eff) return p;
            const low = eff.values.map(v => v.toLowerCase());
            const hasNonce = low.some(v => v.indexOf("'nonce-") === 0);
            const hasHash = low.some(v => /^'sha(256|384|512)-/.test(v));
            const strictDyn = low.indexOf("'strict-dynamic'") > -1;
            if (!hasNonce && !hasHash && !strictDyn && low.indexOf("'unsafe-inline'") > -1) return p;
            if (eff.values.indexOf("'nonce-" + nonce + "'") > -1) return p;
            if (low.length === 1 && low[0] === "'none'") eff.values = [];
            eff.values.push("'nonce-" + nonce + "'");
            changed = true;
            return ' ' + dirs.map(d => [d.name].concat(d.values).join(' ')).join('; ');
        });
        out[k] = rewritten.join(',').trim();
    });
    return { nonce: nonce, headers: changed ? out : null };
}

function randomNonce() {
    const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let s = '';
    for (let i = 0; i < 22; i++) s += a[Math.floor(Math.random() * a.length)];
    return s;
}

function safeJSON(v) {
    return JSON.stringify(v).replace(/</g, '\\u003c')
        .replace(new RegExp('\\u2028', 'g'), '\\u2028').replace(new RegExp('\\u2029', 'g'), '\\u2029');
}

function buildPayload(geo) {
    const S = { ip: geo.ip, country: geo.country, lat: geo.lat, lon: geo.lon, timezone: geo.timezone };
    const C = {
        spoofGeolocation: CFG.spoofGeolocation, spoofTimezone: CFG.spoofTimezone,
        deepDatePatch: CFG.deepDatePatch, stealthToString: CFG.stealthToString,
        rtcProtection: CFG.rtcProtection, accuracyRange: CFG.accuracyRange,
        jitterMeters: CFG.jitterMeters, langList: langListFor(geo.country),
    };
    return '(' + PAGE.toString() + ')(' + safeJSON(S) + ',' + safeJSON(C) + ');';
}

/* ══════════════════════════════════════════════════
   7. 页面侧补丁（序列化后注入，运行在页面里）
   结果已由 QX 查好并写入 S，页面内不发任何网络请求。
   ══════════════════════════════════════════════════ */
function PAGE(S, C) {
    'use strict';
    try {
        const RealDate = Date;
        const RealDTF = Intl.DateTimeFormat;
        const _realTZO = RealDate.prototype.getTimezoneOffset;
        const _realToString = RealDate.prototype.toString;
        const _realFTS = Function.prototype.toString;
        const pad2 = n => (n < 10 ? '0' + n : '' + n);
        const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        let TZ = null;
        try { new RealDTF('en-US', { timeZone: S.timezone }); TZ = S.timezone; } catch (e) { }
        const LANG = C.langList && C.langList.length ? C.langList.slice() : null;

        const _nativeSrc = new WeakMap();
        const markNative = (fn, src) => {
            try { _nativeSrc.set(fn, src || ('function ' + (fn.name || '') + '() { [native code] }')); } catch (e) { }
            return fn;
        };
        if (C.stealthToString) {
            const pts = markNative(function toString() {
                const s = _nativeSrc.get(this);
                return s !== undefined ? s : _realFTS.call(this);
            }, 'function toString() { [native code] }');
            try { Function.prototype.toString = pts; } catch (e) { }
        }

        const _fmt = new Map();
        const offEast = (tz, ms) => {
            if (!tz || !isFinite(ms)) return 0;
            try {
                let f = _fmt.get(tz);
                if (!f) {
                    f = new RealDTF('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit',
                        day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    _fmt.set(tz, f);
                }
                const o = {};
                f.formatToParts(ms).forEach(p => { if (p.type !== 'literal') o[p.type] = p.value; });
                const asUTC = RealDate.UTC(+o.year, +o.month - 1, +o.day, +o.hour, +o.minute, +o.second);
                return Math.round((asUTC - Math.floor(ms / 1000) * 1000) / 60000);
            } catch (e) { return 0; }
        };
        const _ln = new Map();
        const tzLong = (tz, ms) => {
            try {
                let f = _ln.get(tz);
                if (!f) { f = new RealDTF('en-US', { timeZone: tz, timeZoneName: 'long' }); _ln.set(tz, f); }
                const p = f.formatToParts(ms).find(x => x.type === 'timeZoneName');
                if (p) return p.value;
            } catch (e) { }
            return tz;
        };
        const offStr = m => { const a = Math.abs(m); return 'GMT' + (m >= 0 ? '+' : '-') + pad2(Math.floor(a / 60)) + pad2(a % 60); };

        /* —— Geolocation / Permissions —— */
        const makePos = () => {
            const j = C.jitterMeters || 0;
            const cosLat = Math.max(0.2, Math.cos(S.lat * Math.PI / 180));
            const dLat = j ? (Math.random() * 2 - 1) * (j / 111320) : 0;
            const dLon = j ? (Math.random() * 2 - 1) * (j / (111320 * cosLat)) : 0;
            const lo = C.accuracyRange[0], hi = C.accuracyRange[1];
            return {
                coords: { latitude: S.lat + dLat, longitude: S.lon + dLon,
                    accuracy: Math.round(lo + Math.random() * Math.max(0, hi - lo)),
                    altitude: null, altitudeAccuracy: null, heading: null, speed: null },
                timestamp: RealDate.now(),
            };
        };
        if (C.spoofGeolocation) {
            try {
                const geo = navigator.geolocation;
                const GP = geo && Object.getPrototypeOf(geo);
                if (GP) {
                    const _clear = GP.clearWatch;
                    const watches = new Set();
                    let seq = 1000000;
                    GP.getCurrentPosition = markNative(function getCurrentPosition(ok) {
                        setTimeout(() => { try { ok && ok(makePos()); } catch (e) { } }, 0);
                    }, 'function getCurrentPosition() { [native code] }');
                    GP.watchPosition = markNative(function watchPosition(ok) {
                        const id = seq++;
                        watches.add(id);
                        setTimeout(() => { try { if (watches.has(id) && ok) ok(makePos()); } catch (e) { } }, 0);
                        return id;
                    }, 'function watchPosition() { [native code] }');
                    GP.clearWatch = markNative(function clearWatch(id) {
                        if (watches.delete(id)) return;
                        try { _clear.call(this, id); } catch (e) { }
                    }, 'function clearWatch() { [native code] }');
                }
            } catch (e) { }
            try {
                const perms = navigator.permissions;
                const PP = perms && Object.getPrototypeOf(perms);
                if (PP && typeof PP.query === 'function') {
                    const _q = PP.query;
                    PP.query = markNative(function query(desc) {
                        if (desc && desc.name === 'geolocation') {
                            return Promise.resolve({ state: 'granted', name: 'geolocation', onchange: null,
                                addEventListener() { }, removeEventListener() { }, dispatchEvent() { return false; } });
                        }
                        return _q.call(this, desc);
                    }, 'function query() { [native code] }');
                }
            } catch (e) { }
        }

        /* —— Intl / Date —— */
        const withTz = opts => {
            if (TZ && (!opts || !opts.timeZone)) { opts = Object.assign({}, opts); opts.timeZone = TZ; }
            return opts;
        };
        const withLoc = loc => (loc === undefined && LANG) ? LANG[0] : loc;

        if (C.spoofTimezone && TZ) {
            const PDTF = function DateTimeFormat(locale, options) {
                return new RealDTF(withLoc(locale), withTz(options));
            };
            PDTF.prototype = RealDTF.prototype;
            try {
                Object.defineProperty(PDTF, 'length', { value: 0, configurable: true });
            } catch (e) { }
            PDTF.supportedLocalesOf = RealDTF.supportedLocalesOf;
            markNative(PDTF, 'function DateTimeFormat() { [native code] }');
            try { Intl.DateTimeFormat = PDTF; } catch (e) { }

            const DP = RealDate.prototype;
            ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(m => {
                const orig = DP[m];
                DP[m] = markNative({ [m](locale, options) { return orig.call(this, withLoc(locale), withTz(options)); } }[m],
                    'function ' + m + '() { [native code] }');
            });

            DP.getTimezoneOffset = markNative(function getTimezoneOffset() {
                const ms = this.getTime();
                if (!isFinite(ms)) return NaN;
                return -offEast(TZ, ms);
            }, 'function getTimezoneOffset() { [native code] }');

            const G = { getHours: 'getUTCHours', getMinutes: 'getUTCMinutes', getSeconds: 'getUTCSeconds',
                getMilliseconds: 'getUTCMilliseconds', getDate: 'getUTCDate', getDay: 'getUTCDay',
                getMonth: 'getUTCMonth', getFullYear: 'getUTCFullYear' };
            Object.keys(G).forEach(name => {
                const orig = DP[name], utc = G[name];
                DP[name] = markNative({ [name]() {
                    const ms = this.getTime();
                    if (!isFinite(ms)) return orig.call(this);
                    return new RealDate(ms + offEast(TZ, ms) * 60000)[utc]();
                } }[name], 'function ' + name + '() { [native code] }');
            });
            if (DP.getYear) {
                DP.getYear = markNative(function getYear() { return this.getFullYear() - 1900; },
                    'function getYear() { [native code] }');
            }

            const ST = { setHours: 'setUTCHours', setMinutes: 'setUTCMinutes', setSeconds: 'setUTCSeconds',
                setMilliseconds: 'setUTCMilliseconds', setDate: 'setUTCDate', setMonth: 'setUTCMonth',
                setFullYear: 'setUTCFullYear' };
            Object.keys(ST).forEach(name => {
                const orig = DP[name], us = DP[ST[name]];
                DP[name] = markNative({ [name]() {
                    const ms = this.getTime();
                    if (!isFinite(ms)) return orig.apply(this, arguments);
                    const off = offEast(TZ, ms);
                    const wall = new RealDate(ms + off * 60000);
                    const nw = us.apply(wall, arguments);
                    if (!isFinite(nw)) { this.setTime(NaN); return NaN; }
                    let g = nw - off * 60000;
                    for (let i = 0; i < 3; i++) g = nw - offEast(TZ, g) * 60000;
                    this.setTime(g);
                    return g;
                } }[name], 'function ' + name + '() { [native code] }');
            });

            const _tds = DP.toDateString, _tts = DP.toTimeString;
            const wallOf = ms => new RealDate(ms + offEast(TZ, ms) * 60000);
            const dateStr = w => WD[w.getUTCDay()] + ' ' + MO[w.getUTCMonth()] + ' ' + pad2(w.getUTCDate()) + ' ' + w.getUTCFullYear();
            const timeStr = (w, ms) => pad2(w.getUTCHours()) + ':' + pad2(w.getUTCMinutes()) + ':' + pad2(w.getUTCSeconds()) +
                ' ' + offStr(offEast(TZ, ms)) + ' (' + tzLong(TZ, ms) + ')';
            DP.toString = markNative(function toString() {
                const ms = this.getTime();
                if (!isFinite(ms)) return _realToString.call(this);
                const w = wallOf(ms);
                return dateStr(w) + ' ' + timeStr(w, ms);
            }, 'function toString() { [native code] }');
            DP.toDateString = markNative(function toDateString() {
                const ms = this.getTime();
                return isFinite(ms) ? dateStr(wallOf(ms)) : _tds.call(this);
            }, 'function toDateString() { [native code] }');
            DP.toTimeString = markNative(function toTimeString() {
                const ms = this.getTime();
                return isFinite(ms) ? timeStr(wallOf(ms), ms) : _tts.call(this);
            }, 'function toTimeString() { [native code] }');

            if (C.deepDatePatch) {
                const SD = markNative(function Date() {
                    const a = arguments, nt = new.target;
                    if (!nt) return new RealDate(RealDate.now()).toString();
                    let ms;
                    if (a.length === 0) ms = RealDate.now();
                    else if (a.length === 1) ms = new RealDate(a[0]).getTime();
                    else {
                        const t = RealDate.UTC(Number(a[0]), Number(a[1]), a.length > 2 ? Number(a[2]) : 1,
                            a.length > 3 ? Number(a[3]) : 0, a.length > 4 ? Number(a[4]) : 0,
                            a.length > 5 ? Number(a[5]) : 0, a.length > 6 ? Number(a[6]) : 0);
                        if (!isFinite(t)) ms = NaN;
                        else { let g = t; for (let i = 0; i < 3; i++) g = t - offEast(TZ, g) * 60000; ms = g; }
                    }
                    if (nt === SD || nt === RealDate) return new RealDate(ms);
                    try { return Reflect.construct(RealDate, [ms], nt); } catch (e) { return new RealDate(ms); }
                }, 'function Date() { [native code] }');
                SD.prototype = RealDate.prototype;
                SD.now = markNative({ now() { return RealDate.now(); } }.now, 'function now() { [native code] }');
                SD.parse = markNative({ parse(s) { return RealDate.parse(s); } }.parse, 'function parse() { [native code] }');
                SD.UTC = markNative(function UTC() { return RealDate.UTC.apply(null, arguments); }, 'function UTC() { [native code] }');
                try {
                    Object.defineProperty(SD, 'length', { value: 7, configurable: true });
                    Object.defineProperty(SD.UTC, 'length', { value: 7, configurable: true });
                    Object.defineProperty(RealDate.prototype, 'constructor', { value: SD, writable: true, configurable: true, enumerable: false });
                } catch (e) { }
                try { window.Date = SD; } catch (e) { }
            }
        }

        /* —— 语言（langMode ≠ off 才有 LANG）—— */
        if (LANG) {
            try {
                const NP = Object.getPrototypeOf(navigator);
                const gl = markNative(Object.getOwnPropertyDescriptor({ get language() { return LANG[0]; } }, 'language').get,
                    'function get language() { [native code] }');
                const gls = markNative(Object.getOwnPropertyDescriptor({ get languages() { return LANG.slice(); } }, 'languages').get,
                    'function get languages() { [native code] }');
                Object.defineProperty(NP, 'language', { get: gl, configurable: true, enumerable: true });
                Object.defineProperty(NP, 'languages', { get: gls, configurable: true, enumerable: true });
            } catch (e) { }
            ['NumberFormat', 'Collator', 'PluralRules', 'RelativeTimeFormat', 'ListFormat', 'DisplayNames', 'Segmenter'].forEach(name => {
                const O = Intl[name];
                if (typeof O !== 'function') return;
                const P = function (locale, options) { return new O(withLoc(locale), options); };
                try { Object.defineProperty(P, 'name', { value: name, configurable: true }); } catch (e) { }
                try { Object.defineProperty(P, 'length', { value: O.length, configurable: true }); } catch (e) { }
                P.prototype = O.prototype;
                if (O.supportedLocalesOf) P.supportedLocalesOf = O.supportedLocalesOf;
                markNative(P, 'function ' + name + '() { [native code] }');
                try { Intl[name] = P; } catch (e) { }
            });
            if (!(C.spoofTimezone && TZ)) {
                ['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].forEach(m => {
                    const orig = RealDate.prototype[m];
                    RealDate.prototype[m] = markNative({ [m](l, o) { return orig.call(this, withLoc(l), o); } }[m],
                        'function ' + m + '() { [native code] }');
                });
                const PDTF2 = function DateTimeFormat(l, o) { return new RealDTF(withLoc(l), o); };
                PDTF2.prototype = RealDTF.prototype;
                PDTF2.supportedLocalesOf = RealDTF.supportedLocalesOf;
                markNative(PDTF2, 'function DateTimeFormat() { [native code] }');
                try { Intl.DateTimeFormat = PDTF2; } catch (e) { }
            }
            try {
                const _n = Number.prototype.toLocaleString;
                Number.prototype.toLocaleString = markNative({ toLocaleString(l, o) { return _n.call(this, withLoc(l), o); } }.toLocaleString,
                    'function toLocaleString() { [native code] }');
            } catch (e) { }
            try { if (document.documentElement) document.documentElement.setAttribute('lang', LANG[0]); } catch (e) { }
        }

        /* —— WebRTC（默认 off）—— */
        const mode = C.rtcProtection;
        const RTC = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        if (mode && mode !== 'off' && RTC) {
            const isPriv = ip => {
                if (!ip) return true;
                if (ip.indexOf(':') > -1) { const v = ip.toLowerCase(); return v === '::1' || /^(fe80|fc|fd)/.test(v); }
                const p = ip.split('.').map(Number);
                if (p.length !== 4) return false;
                return p[0] === 10 || p[0] === 127 || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
                    (p[0] === 192 && p[1] === 168) || (p[0] === 169 && p[1] === 254) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127);
            };
            const decide = ev => {
                const c = ev && ev.candidate;
                if (!c || !c.candidate) return { a: 'keep' };
                const str = String(c.candidate);
                const ip = str.split(' ')[4];
                if (!ip || /\.local$/i.test(ip)) return { a: 'keep' };
                if (isPriv(ip)) return { a: 'drop' };
                if (mode === 'mdns') return { a: 'drop' };
                if (S.ip && ip === S.ip) return { a: 'keep' };
                if (mode === 'rewrite' && S.ip) {
                    const parts = str.split(' ');
                    parts[4] = S.ip;
                    const nc = { candidate: parts.join(' '), sdpMid: c.sdpMid, sdpMLineIndex: c.sdpMLineIndex,
                        usernameFragment: c.usernameFragment, foundation: (parts[0].split(':')[1] || ''),
                        component: parts[1] || '', protocol: (parts[2] || '').toLowerCase(), priority: Number(parts[3]) || 0,
                        address: S.ip, port: Number(parts[5]) || 0, type: parts[7] || '', relatedAddress: null,
                        relatedPort: null, tcpType: null,
                        toJSON() { return { candidate: this.candidate, sdpMid: this.sdpMid, sdpMLineIndex: this.sdpMLineIndex, usernameFragment: this.usernameFragment }; } };
                    return { a: 'rewrite', c: nc };
                }
                if (/\btyp\s+relay\b/.test(str)) return { a: 'keep' };
                return { a: 'drop' };
            };
            const deliver = (ev, fn, self) => {
                const d = decide(ev);
                if (d.a === 'drop') return undefined;
                if (d.a === 'rewrite') {
                    return fn.call(self, new Proxy(ev, { get: (t, p) => p === 'candidate' ? d.c : Reflect.get(t, p, t) }));
                }
                return fn.call(self, ev);
            };
            let W;
            if (mode === 'block') {
                W = markNative(function RTCPeerConnection() {
                    throw new DOMException('RTCPeerConnection is disabled', 'NotSupportedError');
                }, 'function RTCPeerConnection() { [native code] }');
            } else {
                W = markNative(function RTCPeerConnection() {
                    const pc = new RTC(...arguments);
                    try {
                        const _add = pc.addEventListener.bind(pc), _rm = pc.removeEventListener.bind(pc);
                        const wraps = new WeakMap();
                        pc.addEventListener = function (type, fn, o) {
                            if (type === 'icecandidate' && typeof fn === 'function') {
                                const w = function (ev) { return deliver(ev, fn, this); };
                                wraps.set(fn, w);
                                return _add(type, w, o);
                            }
                            return _add(type, fn, o);
                        };
                        pc.removeEventListener = function (type, fn, o) {
                            if (type === 'icecandidate' && fn && wraps.has(fn)) return _rm(type, wraps.get(fn), o);
                            return _rm(type, fn, o);
                        };
                        let handler = null, raw = null;
                        Object.defineProperty(pc, 'onicecandidate', {
                            configurable: true, enumerable: true,
                            get() { return raw; },
                            set(fn) {
                                if (handler) _rm('icecandidate', handler);
                                raw = fn;
                                handler = typeof fn === 'function' ? function (ev) { return deliver(ev, fn, pc); } : null;
                                if (handler) _add('icecandidate', handler);
                            },
                        });
                    } catch (e) { }
                    return pc;
                }, 'function RTCPeerConnection() { [native code] }');
                try { Object.setPrototypeOf(W, RTC); } catch (e) { }
            }
            try { W.prototype = RTC.prototype; } catch (e) {
                try { Object.defineProperty(W, 'prototype', { value: RTC.prototype }); } catch (e2) { }
            }
            try { window.RTCPeerConnection = W; if (window.webkitRTCPeerConnection) window.webkitRTCPeerConnection = W; } catch (e) { }
        }
    } catch (e) {
        /* 静默：任何失败都不能影响页面 */
    } finally {
        try { const cs = document.currentScript; if (cs && cs.parentNode) cs.parentNode.removeChild(cs); } catch (e) { }
    }
}
