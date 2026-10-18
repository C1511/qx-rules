// Where Am I — FlClash 覆写脚本（FlClash ≥ 0.8.85，Clash Verge Rev 全局扩展脚本也能用）
//
// FlClash 用的 mihomo 内核没有 MitM / 改写响应体的能力，没法像 QX 那样往网页里注入。
// 所以 FlClash 下的做法是：浏览器里照常装原版油猴脚本，本覆写只负责让分流配合它——
//   1. 油猴脚本查出口用的几个接口，强制走「兜底 MATCH」的那个策略组，
//      保证脚本查到的 IP = 外网站点实际看到的 IP（有些规则集会把 ipinfo 等分去别的组）
//   2. 它 debug 自检用的直连探针（myip.ipip.net / 4.ipw.cn）强制 DIRECT
//
// WebRTC：FlClash 开 TUN 模式后浏览器的 UDP（含 STUN）也进隧道，srflx 候选会是节点 IP；
// 只开系统代理时 UDP 不走代理，仍需浏览器扩展 WebRTC Network Limiter。
//
// 安装：工具 → 进阶配置 → 脚本 → 添加 → 粘贴本文件；配置 → 订阅右侧 → 覆写 → 脚本 → 选中。

function main(config) {
  // 指定策略组名；留空则自动取 MATCH 规则的目标（通常是「节点选择」/「漏网之鱼」）
  const TARGET = "";

  const PROXIED = [
    "api.ipify.org", "api64.ipify.org", "ipwho.is", "freeipapi.com",
    "ipinfo.io", "ipapi.co", "httpbin.org", "postman-echo.com",
  ];
  const DIRECT = ["myip.ipip.net", "4.ipw.cn"];

  const rules = Array.isArray(config.rules) ? config.rules : [];
  let target = TARGET;
  if (!target) {
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = String(rules[i]).trim();
      if (/^MATCH\s*,/i.test(r)) { target = r.split(",")[1].trim(); break; }
    }
  }
  if (!target) return config;   // 没有 MATCH 规则就不动

  const add = []
    .concat(DIRECT.map(d => "DOMAIN," + d + ",DIRECT"))
    .concat(PROXIED.map(d => "DOMAIN-SUFFIX," + d + "," + target));
  config.rules = add.concat(rules.filter(r => add.indexOf(r) === -1));
  return config;
}
