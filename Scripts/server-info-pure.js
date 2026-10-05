/***
 * [C1511/qx-rules 审计+加固副本] 节点详情(Pure)
 * 来源: https://ddgksf2013.top/scripts/server-info-pure.js (2025-12-14 版, 用户提供)
 * 原文件 sha256: 559874ea79fd4faf387f6b0d3155928d7ef2275a296c7ac850a23343804e00f3
 *
 * 审计结论: 仅经所选节点向 https://my.ippure.com/v1/info 发一次请求; 不读取节点配置, 不读写持久化存储, 不外传数据。
 * 本地修改 (不改变数据源和显示内容):
 *  1. API 返回的字段写入 HTML 前做转义, 防止返回内容注入页面。
 *  2. 先检查 HTTP 状态码, 非 200 时提示「HTTP xxx」, 不再尝试解析错误页。
 *  3. 新增「IP 来源」一行: 取同一接口返回的 isBroadcast (广播 IP / 原生 IP), 字段缺失时显示「-」。
 *
 * [task_local]
 * event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/server-info-pure.js, tag=节点纯净度详情, img-url=checkmark.shield.fill.system
 
@Description: 使用 IPPure API 查询节点详细信息 (IP, ISP, 地区, 欺诈分数, 类型)
@Update: 2025-12-14
***/

const url = "https://my.ippure.com/v1/info";
const opts = {
    policy: $environment.params
};

const myRequest = {
    url: url,
    headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    },
    opts: opts,
    timeout: 5000
};

$task.fetch(myRequest).then(response => {
    if (response.statusCode !== 200) {
        handleError(`HTTP ${response.statusCode}`);
        return;
    }
    try {
        const data = JSON.parse(response.body);
        const htmlMessage = generateHtmlMessage(data);
        console.log(`节点: ${$environment.params}\nIP: ${data.ip}\nRisk: ${data.fraudScore}`);
        $done({ "title": "    🔎 IPPure 节点详情", "htmlMessage": htmlMessage });
    } catch (e) {
        handleError("解析失败");
    }
}, reason => {
    handleError("查询超时");
});

// [qx-rules] HTML 转义
function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function handleError(msg) {
    const message = `<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: bold;">🛑 ${msg}</p>`;
    $done({ "title": "🔎 IPPure 查询结果", "htmlMessage": message });
}

function generateHtmlMessage(data) {
    let content = "";
    
    const flag = getFlagEmoji(data.countryCode);
    const ip = esc(data.ip || "N/A");
    const isp = esc(data.asOrganization || "N/A");
    const asn = data.asn ? `AS${esc(data.asn)}` : "N/A";
    
    let location = `${flag} ${esc(data.countryCode)}`;
    if (data.region) location += ` - ${esc(data.region)}`;
    if (data.city) location += ` - ${esc(data.city)}`;

    const typeStr = data.isResidential ? "住宅网络 🏠" : "数据中心 🏢";
    // [qx-rules] IP 来源: IPPure /v1/info 文档字段 isBroadcast; 非布尔值时显示 "-"
    const sourceStr = data.isBroadcast === true ? "广播 IP 📡" : data.isBroadcast === false ? "原生 IP ✅" : "-";
    
    const score = data.fraudScore || 0;
    const riskInfo = getRiskLevel(score);

    const infos = [
        ["IP", ip],
        ["ISP", isp],
        ["ASN", asn],
        ["位置", location],
        ["类型", typeStr],
        ["IP 来源", sourceStr],
        ["欺诈值", `${esc(score)} 分`],
        ["风险等级", riskInfo]
    ];

    let res = `<div style="text-align: center; font-family: -apple-system; font-size: 15px; line-height: 1.5;">`;
    res += `<hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;"/>`; // 顶部横线
    
    infos.forEach(item => {
        res += `<b><font color="#888">${item[0]} : </font></b><font color="#000">${item[1]}</font><br/>`;
    });

    res += `<hr style="margin: 10px 0; border: 0; border-top: 1px solid #ddd;"/>`; // 底部横线
    
    // 添加节点名称
    res += `<font color="#6959CD"><b>节点</b> ➟ ${esc($environment.params)}</font>`;
    res += `</div>`;
    
    return res;
}

function getRiskLevel(score) {
    if (score <= 25) return "<font color='#28a745'>低风险 ✅</font>"; // 0-25 绿色
    if (score <= 50) return "<font color='#ffc107'>中风险 🟡</font>"; // 26-50 黄色
    if (score <= 75) return "<font color='#ff8c00'>高风险 ⚠️</font>"; // 51-75 橙色
    return "<font color='#dc3545'>极高风险 ‼️</font>"; // 76-100 红色
}

function getFlagEmoji(countryCode) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

