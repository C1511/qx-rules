/***
 * 节点地理信息 (Quantumult X geo_location_checker)  v2
 *
 * [C1511/qx-rules 自写] 用于替代 I-am-R-E/Functional-Store-Hub 的 IP-API.js (混淆代码, 无法持续审计)
 * 数据源仍为 ip-api.com (与原配置一致): 仅有 IPv4 地址, 不会因节点有 IPv6 出口而查成 IPv6; 支持中文。
 * v1 曾改用 api.ip.sb, 但它是双栈地址, 节点有 IPv6 时返回的是 IPv6 及其(往往不准的)定位, 已弃用。
 *
 * 免费接口只有 HTTP: 请求由 QX 经所测节点发出, 明文只发生在节点与 ip-api 之间。
 * 本脚本只解析 QX 传入的返回内容, 自身不发请求、不读写存储。
 *
 * [general]
 * geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-api-geo.js
 **/

function flag(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return ''
  const cc = code.toUpperCase()
  if (cc === 'TW') return '🇨🇳'
  return String.fromCodePoint(...[...cc].map(ch => 0x1f1a5 + ch.charCodeAt(0)))
}

function uniq(parts) {
  const seen = []
  parts.forEach(p => {
    if (p && seen.indexOf(p) === -1) seen.push(p)
  })
  return seen
}

function country(d) {
  if (d.country === '中华民国' || d.country === '中華民國') return '台湾'
  return d.country
}

let d
try {
  d = $response.statusCode === 200 ? JSON.parse($response.body) : null
} catch (e) {
  d = null
}

if (!d || d.status !== 'success') {
  $done(null)
} else {
  const place = uniq([country(d), d.regionName, d.city]).join(' ')
  const asn = (d.as || '').split(' ')[0]
  const isp = uniq([d.isp, d.org])

  $done({
    title: `${flag(d.countryCode)} ${place}`.trim(),
    subtitle: uniq([asn, d.isp]).join(' · '),
    ip: d.query,
    description: [
      '-----------------------------------',
      place,
      d.timezone,
      d.query,
      `经度: ${d.lon}  纬度: ${d.lat}`,
      d.as,
      isp.join('\n\n'),
    ]
      .filter(Boolean)
      .join('\n\n'),
  })
}
