/***
 * 节点纯净度详情 (Quantumult X event-interaction)  v2
 *
 * [C1511/qx-rules 自写] 用于替代 https://ddgksf2013.top/scripts/server-info-pure.js
 * (原脚本托管在个人域名、无版本记录, 无法获取审计, 故按同样用途重写)
 *
 * 流程 (所有请求都经「长按选中的节点/策略」发出):
 *  1. 锁定落地 IPv4: https://api-ipv4.ip.sb/geoip (仅 IPv4), 失败则用 https://api.ipify.org (仅 IPv4)
 *     —— 避免节点有 IPv6 出口时查到的是 IPv6, 和网站实际看到的 IPv4 不一致
 *  2. 用这个 IPv4 并行查询 3 个独立数据源, 并排展示, 便于交叉判断:
 *       http://ip-api.com/json/<ip>       位置(中文)、ISP、ASN、hosting/proxy/mobile 标记
 *       https://api.ipapi.is/?q=<ip>      机房/VPN/代理/Tor/滥用标记、公司类型、ASN 注册国、滥用评分
 *       https://proxycheck.io/v2/<ip>     IP 类型(住宅/企业/机房/移动)、代理判定、风险分
 *  3. 某个数据源失败或缺字段时显示「-」或失败原因, 不会当作「否」。
 *
 * ip-api.com 免费接口只有 HTTP: 这段明文只发生在节点与 ip-api 之间, 内容是落地 IP 本身。
 * 不读取节点配置, 不读写持久化存储, 不发通知, 不请求上述以外的地址。
 *
 * [task_local]
 * event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-purity.js, tag=节点纯净度详情, img-url=checkmark.shield.fill.system
 **/

const POLICY = $environment.params
const TIMEOUT = 8000

function fetchText(url) {
  return $task.fetch({ url, opts: { policy: POLICY }, timeout: TIMEOUT }).then(resp => {
    if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`)
    return resp.body
  })
}

function fetchJSON(url) {
  return fetchText(url).then(body => {
    try {
      return JSON.parse(body)
    } catch (e) {
      throw new Error('返回内容不是 JSON')
    }
  })
}

function settle(p) {
  return p.then(
    v => ({ ok: true, v }),
    e => ({ ok: false, err: (e && e.message) || String(e) })
  )
}

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/

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

// 三态: 只有明确为 true/false 才给结论, 缺失一律显示「-」
function tri(v) {
  if (v === true) return '⚠️ 是'
  if (v === false) return '✅ 否'
  return '-'
}

function place(...parts) {
  const seen = []
  parts.forEach(p => {
    if (p && seen.indexOf(p) === -1) seen.push(p)
  })
  return seen.length ? esc(seen.join(' ')) : '-'
}

const COMPANY_TYPE = { isp: '运营商/住宅', hosting: '机房', business: '企业', education: '教育', government: '政府', banking: '金融' }
const PROXYCHECK_TYPE = { Residential: '住宅', Business: '企业', Hosting: '机房', Wireless: '移动网络', VPN: 'VPN' }

function typeName(map, v) {
  if (!v) return '-'
  return map[v] ? `${map[v]} (${esc(v)})` : esc(v)
}

function row(k, v) {
  return `<b>${k}</b>: ${v}`
}

function section(title) {
  return `</br><font color=#6959CD><b>【${title}】</b></font>`
}

function failed(name, r) {
  return row(name, `查询失败 (${esc(r.err)})`)
}

async function getIPv4() {
  const sb = await settle(fetchJSON('https://api-ipv4.ip.sb/geoip'))
  if (sb.ok && IPV4.test(sb.v.ip || '')) return { ip: sb.v.ip, sb }
  const fy = await settle(fetchJSON('https://api.ipify.org?format=json'))
  if (fy.ok && IPV4.test(fy.v.ip || '')) return { ip: fy.v.ip, sb }
  throw new Error(`无法获取落地 IPv4 (ip.sb: ${sb.ok ? '无 IPv4' : sb.err}; ipify: ${fy.ok ? '无 IPv4' : fy.err})`)
}

;(async () => {
  const { ip, sb } = await getIPv4()

  const [ia, ii, pc] = await Promise.all([
    settle(
      fetchJSON(
        `http://ip-api.com/json/${ip}?lang=zh-CN&fields=status,message,country,countryCode,regionName,city,isp,org,as,mobile,proxy,hosting,query`
      ).then(d => {
        if (d.status !== 'success') throw new Error(d.message || 'ip-api 查询失败')
        return d
      })
    ),
    settle(
      fetchJSON(`https://api.ipapi.is/?q=${ip}`).then(d => {
        if (!d || d.error || d.ip !== ip) throw new Error((d && d.error) || 'ipapi.is 返回异常')
        return d
      })
    ),
    settle(
      fetchJSON(`https://proxycheck.io/v2/${ip}?vpn=1&asn=1&risk=1`).then(d => {
        if (!d || (d.status !== 'ok' && d.status !== 'warning') || !d[ip]) {
          throw new Error((d && (d.message || d.status)) || 'proxycheck 返回异常')
        }
        return d[ip]
      })
    ),
  ])

  const lines = [row('落地 IPv4', esc(ip))]

  lines.push(section('位置'))
  lines.push(ia.ok ? row('ip-api', `${flag(ia.v.countryCode)} ${place(ia.v.country, ia.v.regionName, ia.v.city)}`) : failed('ip-api', ia))
  if (ii.ok) {
    const l = ii.v.location || {}
    lines.push(row('ipapi.is', `${flag(l.country_code)} ${place(l.country, l.state, l.city)}`))
  } else lines.push(failed('ipapi.is', ii))
  if (sb.ok && sb.v.ip === ip) lines.push(row('ip.sb', `${flag(sb.v.country_code)} ${place(sb.v.country, sb.v.region, sb.v.city)}`))

  lines.push(section('网络'))
  if (ia.ok) {
    lines.push(row('ASN', esc(ia.v.as)))
    lines.push(row('ISP', esc(ia.v.isp)))
    lines.push(row('组织', esc(ia.v.org)))
  } else if (ii.ok) {
    const a = ii.v.asn || {}
    lines.push(row('ASN', a.asn ? `AS${esc(a.asn)} ${esc(a.org)}` : '-'))
    lines.push(row('公司', esc((ii.v.company || {}).name)))
  } else lines.push(row('ASN', '-'))

  lines.push(section('IP 类型'))
  if (ii.ok) {
    lines.push(row('ipapi.is 公司类型', typeName(COMPANY_TYPE, (ii.v.company || {}).type)))
    lines.push(row('ipapi.is ASN 类型', typeName(COMPANY_TYPE, (ii.v.asn || {}).type)))
    lines.push(row('ipapi.is 机房', tri(ii.v.is_datacenter)))
    lines.push(row('ipapi.is 移动网络', tri(ii.v.is_mobile)))
  } else lines.push(failed('ipapi.is', ii))
  if (ia.ok) lines.push(row('ip-api 机房', tri(ia.v.hosting)))
  lines.push(pc.ok ? row('proxycheck 类型', typeName(PROXYCHECK_TYPE, pc.v.type)) : failed('proxycheck', pc))

  lines.push(section('原生 IP (启发式)'))
  if (ii.ok) {
    const reg = String((ii.v.asn || {}).country || '').toUpperCase()
    const geo = String((ii.v.location || {}).country_code || '').toUpperCase()
    if (reg && geo) {
      lines.push(
        reg === geo
          ? row('判断', `✅ ASN 注册地与定位一致 (${flag(reg)} ${esc(reg)})`)
          : row('判断', `⚠️ 可能为广播 IP: ASN 注册于 ${flag(reg)} ${esc(reg)}, 定位于 ${flag(geo)} ${esc(geo)}`)
      )
    } else lines.push(row('判断', '- (数据不足)'))
  } else lines.push(row('判断', '- (ipapi.is 查询失败)'))

  lines.push(section('风险'))
  if (ii.ok) {
    lines.push(row('VPN', tri(ii.v.is_vpn)))
    lines.push(row('代理', tri(ii.v.is_proxy)))
    lines.push(row('Tor', tri(ii.v.is_tor)))
    lines.push(row('滥用记录', tri(ii.v.is_abuser)))
    lines.push(row('滥用评分', esc((ii.v.company || {}).abuser_score || (ii.v.asn || {}).abuser_score)))
  }
  if (ia.ok) lines.push(row('ip-api 代理', tri(ia.v.proxy)))
  if (pc.ok) {
    lines.push(row('proxycheck 代理', pc.v.proxy === 'yes' ? '⚠️ 是' : pc.v.proxy === 'no' ? '✅ 否' : '-'))
    lines.push(row('proxycheck 风险分', pc.v.risk === undefined ? '-' : `${esc(pc.v.risk)} / 100`))
  }
  if (!ii.ok && !ia.ok && !pc.ok) lines.push(row('结论', '- (数据源均查询失败)'))

  lines.push('')
  lines.push(`<font color=#6959CD><b>节点</b> ➟ ${esc(POLICY)}</font>`)

  $done({
    title: '🛡 节点纯净度',
    htmlMessage:
      '<p style="text-align: center; font-family: -apple-system; font-size: large; font-weight: thin">' +
      lines.join('</br>') +
      '</p>',
  })
})().catch(e => {
  $done({ title: '🛡 节点纯净度', htmlMessage: `<p style="text-align: center">🛑 ${esc((e && e.message) || e)}</p>` })
})
