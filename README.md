# PUBG 战绩查询小程序

基于微信小程序 + Node.js 的 PUBG 战绩查询工具。

## 功能特性

- 🔍 **玩家搜索** — 支持 Steam / Kakao / Xbox / PSN 平台
- 📊 **战绩概览** — K/D、胜率、前10率、击杀、伤害、爆头等核心指标
- 🏆 **赛季切换** — 查看不同赛季的战绩数据
- 📋 **历史比赛** — 最近 20 场比赛数据，包括排名、击杀、伤害、地图等
- 🎯 **比赛详情** — 查看单场比赛的完整玩家数据

## 项目结构

```
pubg-stats-miniprogram/
├── server/                          # 后端代理服务
│   ├── src/
│   │   ├── index.js                 # Express 入口
│   │   ├── config.js                # 配置
│   │   ├── routes/
│   │   │   ├── players.js           # 玩家搜索/详情
│   │   │   ├── seasons.js           # 赛季/战绩
│   │   │   └── matches.js           # 比赛详情
│   │   └── services/
│   │       └── pubg-api.js          # PUBG API 客户端
│   ├── .env.example                 # 环境变量模板
│   └── package.json
├── miniprogram/                     # 微信小程序前端
│   ├── app.js / app.json / app.wxss
│   ├── pages/
│   │   ├── index/                   # 搜索页
│   │   ├── stats/                   # 战绩概览页
│   │   └── matches/                 # 历史比赛页
│   └── utils/
│       └── api.js                   # API 请求封装
└── README.md
```

## 快速开始

### 1. 获取 PUBG API Key

前往 [PUBG Developer Portal](https://developer.pubg.com/) 注册账号并创建应用，获取 API Key。

### 2. 启动后端代理服务

```bash
cd server

# 复制环境变量配置
cp .env.example .env

# 编辑 .env 文件，填入你的 PUBG_API_KEY
# PUBG_API_KEY=your_api_key_here

# 安装依赖
npm install

# 启动服务
npm start
```

服务启动后默认运行在 `http://localhost:3000`，可用 `curl http://localhost:3000/api/health` 验证。

### 3. 启动小程序

1. 打开 **微信开发者工具**
2. 项目目录选择 `miniprogram/`
3. 在 `app.js` 中确认 `apiBaseUrl` 指向你的后端地址
   - 开发环境：`http://localhost:3000/api`（需在微信开发者工具中关闭「域名校验」）
   - 生产环境：替换为已备案的 HTTPS 域名
4. 编译运行

> ⚠️ **注意**: 微信小程序生产环境要求所有请求域名必须已备案且配置在小程序后台的「request 合法域名」中。开发时可以勾选「不校验合法域名」来使用本地调试。

## 后端 API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| GET | `/api/players/search?platform=steam&name=playerName` | 搜索玩家 |
| GET | `/api/players/:id?platform=steam` | 获取玩家详情（含比赛 ID 列表） |
| GET | `/api/seasons?platform=steam` | 获取赛季列表 |
| GET | `/api/seasons/lifetime/:accountId?platform=steam` | 获取生涯总战绩 |
| GET | `/api/seasons/:seasonId/player/:accountId?platform=steam` | 获取赛季战绩 |
| GET | `/api/matches/:matchId?platform=steam` | 获取比赛详情 |
| GET | `/api/matches/batch/list?platform=steam&ids=id1,id2` | 批量获取比赛 |

## 注意事项

- **网络要求**: PUBG 官方 API 服务器在海外，国内服务器可能需要配置 HTTP 代理
- **限流**: PUBG API 免费版限流 10 次/分钟，注意不要频繁请求
- **小程序备案**: 上线前必须拥有已备案的 HTTPS 域名，并在小程序后台配置 request 白名单
- **API Key 安全**: 后端代理服务部署时请确保 API Key 不会泄露到前端