# qx-rules

Quantumult X 自用重写规则。

## Adblock4limbo-reject-only.conf

基于 [limbopro/Adblock4limbo](https://github.com/limbopro/Adblock4limbo)（MIT License，2026-10-02 版本）精简：

- 移除全部 `script-response-body` 规则（向网页注入 limbopro.com 远程 JS）
- 移除 `url 307` 重定向规则与 `*.cloudfront.net` MITM
- 仅保留 `reject` 类规则；MITM hostname 由 473 个缩减为 26 个

```
https://raw.githubusercontent.com/C1511/qx-rules/main/Adblock4limbo-reject-only.conf, tag=毒奶去广告·精简, update-interval=172800, opt-parser=false, enabled=true
```
