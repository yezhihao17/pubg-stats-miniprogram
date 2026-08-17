// app.js
App({
  globalData: {
    // 后端 API 地址（开发时用本地地址，上线需替换为已备案域名）
    apiBaseUrl: 'http://127.0.0.1:3000/api',
    // 当前选中的玩家信息
    currentPlayer: null,
    // 当前选中的平台
    currentPlatform: 'steam',
  },
});