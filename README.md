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
| `server-info-pure.js` | ddgksf2013（2025-12-14 版） | 只经所选节点向 IPPure（`my.ippure.com/v1/info`，HTTPS）发一次请求，本身比较安全。修改：返回字段写入 HTML 前做转义；先检查 HTTP 状态码。数据和显示与原版一致 |
| `net-lsp-x.js` | [xream](https://github.com/xream/scripts) | 数据源、默认参数、显示内容与原版一致。修改：① 节点域名原本用明文 `http://223.6.6.6/resolve` 直连解析，改为同一解析器的 HTTPS 接口（失败时回退 Cloudflare DoH）；② 用入口 IP 查落地信息原本从本机明文直连 `http://ip-api.com`，改为经所选节点发出；③ 去掉 pingan / speedtest.cn 域名的变量拼接 |
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
