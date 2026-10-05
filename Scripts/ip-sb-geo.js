/***
 * 节点地理信息 (Quantumult X geo_location_checker)
 *
 * [C1511/qx-rules 自写] 用于替代 I-am-R-E/Functional-Store-Hub 的 IP-API.js
 * (原脚本为混淆代码, 审计后未发现网络请求, 但无法持续审计其更新; 且依赖明文 http://ip-api.com)
 *
 * 行为: 只解析 QX 通过所测节点请求 https://api.ip.sb/geoip 得到的 JSON, 自身不发任何请求、不读写存储。
 *
 * [general]
 * geo_location_checker=https://api.ip.sb/geoip, https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-sb-geo.js
 **/

function flag(code) {
  if (!/^[A-Za-z]{2}$/.test(code || '')) return ''
  const cc = code.toUpperCase()
  if (cc === 'TW') return '🇨🇳'
  return String.fromCodePoint(...[...cc].map(ch => 0x1f1a5 + ch.charCodeAt(0)))
}

function join(parts, sep) {
  return parts.filter((v, i, arr) => v && arr.indexOf(v) === i).join(sep)
}

if ($response.statusCode !== 200) {
  $done(null)
} else {
  const d = JSON.parse($response.body)
  const place = join([d.country, d.region, d.city], ' ')
  const asn = d.asn ? `AS${d.asn}` : ''
  const org = d.asn_organization || d.organization || d.isp || ''

  $done({
    title: `${flag(d.country_code)} ${place}`.trim(),
    subtitle: join([asn, org], ' · '),
    ip: d.ip,
    description: [
      '-----------------------------------',
      place,
      d.timezone,
      d.ip,
      `经度: ${d.longitude}  纬度: ${d.latitude}`,
      join([d.isp, d.organization, d.asn_organization], '\n\n'),
    ]
      .filter(Boolean)
      .join('\n\n'),
  })
}
