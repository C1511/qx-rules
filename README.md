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

原则：**以原脚本为准，只做不改变查询结果的安全修改**。每个文件头都记录了来源和原文件 sha256，每处修改都用相同输入与原版比对过输出。

| 脚本 | 来源 | 审计结论 / 修改 |
|---|---|---|
| `server-info-pure.js` | ddgksf2013（2025-12-14 版） | 只经所选节点向 IPPure（`my.ippure.com/v1/info`，HTTPS）发一次请求，本身比较安全。修改：返回字段写入 HTML 前做转义；先检查 HTTP 状态码；新增「IP 来源」（同一接口的 `isBroadcast`：广播 IP / 原生 IP） |
| `net-lsp-x.js` | [xream](https://github.com/xream/scripts) | 显示格式与原版一致。修改：① 节点域名原本用明文 `http://223.6.6.6/resolve` 直连解析，改为同一解析器的 HTTPS 接口（失败时回退 Cloudflare DoH）；② 用入口 IP 查落地信息原本从本机明文直连 `http://ip-api.com`，改为经所选节点发出；③ 去掉 pingan / speedtest.cn 域名的变量拼接；④ 国内 IP 默认查询源由平安改为原脚本内置的 ipip.net（平安返回的 IP 和位置不准） |
| `IP-API.js` | [I-am-R-E](https://github.com/I-am-R-E/Functional-Store-Hub) v1.3 | 原版为混淆代码。逐函数还原为可读代码，12 组输入与原版逐字一致；不发任何网络请求 |
| `streaming-ui-check.js` | [KOP-XIAO](https://github.com/KOP-XIAO/QuantumultX) | 请求均经所选节点发往流媒体官方域名。修复：Disney 第二个请求漏了 `policy`，会按分流走、可能直连 |
| `geo_location.js` | [KOP-XIAO](https://github.com/KOP-XIAO/QuantumultX) | 只经所选节点请求 `https://api.ip.sb/geoip`，未改动 |

```
[general]
geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/IP-API.js

[task_local]
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/streaming-ui-check.js, tag=流媒体 - 解锁查询, img-url=checkmark.seal.system, enabled=true
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/geo_location.js, tag=GeoIP 查询, img-url=location.fill.viewfinder.system
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/net-lsp-x.js, tag=网络信息查询, img-url=link.circle.system, enabled=true
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/server-info-pure.js, tag=节点纯净度详情, img-url=checkmark.shield.fill.system
```

## WhereAmI.conf：时区 / 定位跟随出口

改自 Greasy Fork [#600207 Where Am I — Follow Proxy IP](https://greasyfork.org/scripts/600207)（Z健C，v6.6.6，**CC BY-NC-SA 4.0**，本改编沿用同一协议，不可商用）。与上面「只做安全修改」的脚本不同，这是**移植改写**：页面补丁逻辑沿用原版，取数方式改为 QX 实现。

- 注入的补丁覆盖 Geolocation / Permissions、`Intl.DateTimeFormat`、`Date`（getter / setter / toString / 构造器），可选 WebRTC 候选过滤、语言对齐
- 出口 IP 与归属地由 QX 经 `$task.fetch` 查询（ipify → ipwho.is / freeipapi / ipinfo / ipapi.co 投票），**页面内不发任何请求**；注入的 `<script>` 执行后自删
- 出口 IP 每 60 秒复检，归属地按 IP 缓存 6 小时；切节点后可手动跑一次 task 立即刷新
- CSP：页面有 nonce 就复用，否则只在本就禁止内联脚本的策略里追加 nonce，不放宽页面自身限制
- 跳过：国内站点列表 / `.cn`、非 HTML、非 UTF-8、fetch/XHR 拿回的 HTML 片段
- 配置：改 `Scripts/where-am-i.js` 顶部 `DEFAULTS`，或在 QX 持久化写 `wai_config`（JSON，只写要改的字段）。`langMode` 设为 `match` / `en` 时，同时启用 conf 里注释掉的 `script-request-header` 那行，让 `Accept-Language` 与 JS 一致
- ⚠ 只有 `hostname` 里的站点会生效；MitM 对所有 App 生效，带证书锁定的 App 会连不上。Safari 走 QUIC 会绕过 MitM，需要时丢弃 UDP 443

```
[rewrite_remote]
https://raw.githubusercontent.com/C1511/qx-rules/main/WhereAmI.conf, tag=Where Am I, update-interval=172800, opt-parser=false, enabled=true

[task_local]
event-interaction https://raw.githubusercontent.com/C1511/qx-rules/main/Scripts/where-am-i.js, tag=Where Am I · 刷新出口, img-url=location.circle.system, enabled=true
```

### FlClash/where-am-i.js

mihomo 内核没有 MitM，FlClash 无法改网页，浏览器里仍用原版油猴脚本。这个覆写脚本（FlClash ≥ 0.8.85）只做分流配合：油猴脚本查出口用的接口固定走 `MATCH` 的策略组（保证它查到的 = 网站看到的），直连探针 `myip.ipip.net` / `4.ipw.cn` 固定 DIRECT。WebRTC：开 TUN 时 STUN 也进隧道；只开系统代理仍需 WebRTC Network Limiter 扩展。

安装：工具 → 进阶配置 → 脚本 → 添加，粘贴 `FlClash/where-am-i.js`；再在订阅的「覆写 → 脚本」里选中。
