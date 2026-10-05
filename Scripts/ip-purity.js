/***
 * 节点纯净度详情 (Quantumult X event-interaction)
 *
 * [C1511/qx-rules 自写] 用于替代 https://ddgksf2013.top/scripts/server-info-pure.js
 * (原脚本托管在个人域名、无版本记录, 无法获取审计, 故按同样用途重写)
 *
 * 行为:
 *  - 仅通过「长按选中的节点/策略」发起 HTTPS 请求:
 *      https://api.ipapi.is/           落地 IP、ASN、机房/VPN/代理/Tor/滥用标记
 *      https://proxycheck.io/v2/<ip>   IP 类型(住宅/机房/商业/移动)、代理判定、风险分
 *  - 不读取节点配置, 不读写持久化存储, 不发通知, 不请求其它地址。
 *
 * [task_local]
 * event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-purity.js, tag=节点纯净度详情, img-url=checkmark.shield.fill.system
 **/

const POLICY = $environment.params
const TIMEOUT = 8000

function get(url) {
  return $task.fetch({ url, opts: { policy: POLICY }, timeout: TIMEOUT }).then(resp => {
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`)
    return JSON.parse(resp.body)
  })
}

function esc(v) {
  if (v === undefined || v === null || v === '') return '-'
  return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function flag(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return ''
  const cc = code.toUpperCase()
  if (cc === 'TW') return '🇨🇳'
  return String.fromCodePoint(...[...cc].map(ch => 0x1f1a5 + ch.charCodeAt(0)))
}

function yn(v) {
  return v ? '⚠️ 是' : '✅ 否'
}

function row(k, v) {
  return `<b>${k}</b>: ${v}`
}

;(async () => {
  const lines = []
  let ip = ''

  try {
    const a = await get('https://api.ipapi.is/')
    ip = a.ip || ''
    const loc = a.location || {}
    const asn = a.asn || {}
    const company = a.company || {}
    lines.push(row('落地 IP', esc(ip)))
    lines.push(row('位置', `${flag(loc.country_code)} ${esc(loc.country)} ${loc.city ? esc(loc.city) : ''}`))
    lines.push(row('ASN', `AS${esc(asn.asn)} ${esc(asn.org)}`))
    lines.push(row('ASN 类型', esc(asn.type)))
    lines.push(row('公司类型', esc(company.type)))
    lines.push('')
    lines.push(row('机房 IP', yn(a.is_datacenter)))
    lines.push(row('VPN', yn(a.is_vpn)))
    lines.push(row('代理', yn(a.is_proxy)))
    lines.push(row('Tor', yn(a.is_tor)))
    lines.push(row('滥用记录', yn(a.is_abuser)))
    lines.push(row('滥用评分', esc(company.abuser_score || asn.abuser_score)))
  } catch (e) {
    lines.push(row('ipapi.is', `查询失败 (${esc(e && e.message ? e.message : e)})`))
  }

  if (ip) {
    try {
      const p = await get(`https://proxycheck.io/v2/${encodeURIComponent(ip)}?vpn=1&asn=1&risk=1`)
      const d = p[ip] || {}
      lines.push('')
      lines.push(row('IP 类型', esc(d.type)))
      lines.push(row('代理判定', d.proxy === 'yes' ? '⚠️ 是' : d.proxy === 'no' ? '✅ 否' : '-'))
      lines.push(row('风险分', d.risk === undefined ? '-' : `${esc(d.risk)} / 100`))
    } catch (e) {
      lines.push('')
      lines.push(row('proxycheck.io', `查询失败 (${esc(e && e.message ? e.message : e)})`))
    }
  }

  lines.push('')
  lines.push(`<font color=#6959CD><b>节点</b> ➟ ${esc(POLICY)}</font>`)

  const html =
    '<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">' +
    '------------------------------</br>' +
    lines.join('</br>') +
    '</br>------------------------------</p>'

  $done({ title: '🛡 节点纯净度', htmlMessage: html })
})().catch(e => {
  $done({ title: '🛡 节点纯净度', htmlMessage: `<p style="text-align: center">🛑 ${esc(e && e.message ? e.message : e)}</p>` })
})
