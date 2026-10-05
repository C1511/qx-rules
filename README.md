# qx-rules

Quantumult X 自用规则与脚本，均经过人工审计。

## Adblock4limbo-reject-only.conf

基于 [limbopro/Adblock4limbo](https://github.com/limbopro/Adblock4limbo)（MIT License，2026-10-02 版本）精简：

- 移除全部 `script-response-body` 规则（向网页注入 limbopro.com 远程 JS）
- 移除 `url 307` 重定向规则与 `*.cloudfront.net` MITM
- 仅保留 `reject` 类规则；MITM hostname 由 473 个缩减为 26 个

```
https://raw.githubusercontent.com/C1511/qx-rules/main/Adblock4limbo-reject-only.conf, tag=毒奶去广告·精简, update-interval=172800, opt-parser=false, enabled=true
```

## Filter/dns-guard.list：DNS 防泄漏

`host-keyword, ., 🕹 兜底策略`：没被任何域名规则命中的域名直接交给兜底策略，不再为了匹配 geoip / ip-cidr 规则而在本地解析（写法来自官方 [sample.conf](https://github.com/crossutility/Quantumult-X/blob/master/sample.conf)）。纯 IP 请求不受影响。

- 需要「其他设置 → 分流匹配优化」开启，并在 `[filter_remote]` 中**放在所有域名类列表之后、IP 类列表（ChinaIPs、ChinaASN 等）之前**
- 不要加 `force-policy`；配置里需要有名为 `🕹 兜底策略` 的策略组，并且它应当选节点

```
[filter_remote]
https://raw.githubusercontent.com/C1511/qx-rules/main/Filter/dns-guard.list, tag=DNS 防泄漏, update-interval=172800, opt-parser=false, enabled=true
```

## Scripts：审计过的脚本

文件头记录了来源 URL 和原文件 sha256（2026-10-05 下载）。

| 脚本 | 来源 | 审计结论 / 修改 |
|---|---|---|
| `streaming-ui-check.js` | [KOP-XIAO](https://github.com/KOP-XIAO/QuantumultX) | 请求均经所选节点发往流媒体官方域名。修复：Disney 第二个请求漏了 `policy`，可能按分流直连 |
| `geo_location.js` | [KOP-XIAO](https://github.com/KOP-XIAO/QuantumultX) | 仅经所选节点请求 ip.sb。修复：原用双栈的 `api.ip.sb`，节点有 IPv6 出口时会查成 IPv6，改为只走 IPv4 的 `api-ipv4.ip.sb` |
| `net-lsp-x.js` | [xream](https://github.com/xream/scripts) | **原版在 QX 中会通过 `get_server_description` 读取节点完整配置（含密码/UUID），并把节点域名以明文发给阿里 DNS（`http://223.6.6.6`），再发给平安和 ip-api**。已删除读取节点配置的逻辑，DNS 默认改为 Cloudflare DoH，落地查询改为 HTTPS，并去掉了混淆拼接的域名 |
| `ip-purity.js` | 自写 v2 | 替代 `ddgksf2013.top/scripts/server-info-pure.js`（托管在个人域名，无法审计）。先通过只走 IPv4 的接口锁定落地 IPv4，再并排展示 ip-api.com、ipapi.is、proxycheck.io 三个数据源的位置、IP 类型、原生判断和风险；查询失败时显示「-」或失败原因，不会显示成「否」 |
| `ip-api-geo.js` | 自写 v2 | 替代 `I-am-R-E/IP-API.js`（混淆代码）。数据源仍是 ip-api.com（只有 IPv4、有中文）；只解析 QX 传入的结果，自身不发请求。v1 用的 `api.ip.sb` 是双栈地址，节点有 IPv6 出口时会查成 IPv6，已弃用 |

```
[general]
geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-api-geo.js

[task_local]
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/streaming-ui-check.js, tag=流媒体 - 解锁查询, img-url=checkmark.seal.system, enabled=true
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/geo_location.js, tag=GeoIP 查询, img-url=location.fill.viewfinder.system
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/net-lsp-x.js, tag=网络信息查询, img-url=link.circle.system, enabled=true
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/ip-purity.js, tag=节点纯净度详情, img-url=checkmark.shield.fill.system
```
