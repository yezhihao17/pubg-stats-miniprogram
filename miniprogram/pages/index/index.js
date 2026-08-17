// pages/index/index.js
const api = require('../../utils/api');
const HISTORY_KEY = 'pubg_search_history';
const MAX_HISTORY = 5;

Page({
  data: {
    platform: 'steam',
    playerName: '',
    players: [],
    searched: false,
    searching: false,
    error: '',
    canSearch: false,
    searchHistory: [],
  },

  onLoad() {
    this.loadHistory();
  },

  // 加载历史记录
  loadHistory() {
    const history = wx.getStorageSync(HISTORY_KEY) || [];
    this.setData({ searchHistory: history });
  },

  // 保存历史记录
  saveHistory(name, platform, playerId) {
    let history = wx.getStorageSync(HISTORY_KEY) || [];
    // 去重：如果已存在相同玩家名，先移除旧记录
    history = history.filter((h) => h.name !== name);
    // 添加到最前面
    history.unshift({ name, platform, playerId, time: Date.now() });
    // 限制最多 5 条
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    wx.setStorageSync(HISTORY_KEY, history);
    this.setData({ searchHistory: history });
  },

  // 选择平台
  onSelectPlatform(e) {
    const platform = e.currentTarget.dataset.platform;
    this.setData({ platform });
  },

  // 输入昵称
  onInputName(e) {
    const name = e.detail.value;
    this.setData({
      playerName: name,
      canSearch: name.trim().length > 0,
    });
  },

  // 搜索玩家
  async onSearch() {
    const { platform, playerName, searching } = this.data;
    const trimmed = (playerName || '').trim();
    if (!trimmed || searching) return;

    this.setData({ searching: true, error: '', searched: false });

    try {
      const result = await api.searchPlayers(platform, trimmed);
      const players = (result.players || []).map((p) => ({
        ...p,
        initial: p.name ? p.name.charAt(0).toUpperCase() : '?',
      }));
      this.setData({
        players,
        searched: true,
        searching: false,
      });
    } catch (err) {
      console.error('[PUBG] 搜索失败:', JSON.stringify(err));
      this.setData({
        error: err.message || '搜索失败',
        players: [],
        searched: true,
        searching: false,
      });
    }
  },

  // 选择玩家 -> 跳转到战绩页
  onSelectPlayer(e) {
    const index = e.currentTarget.dataset.index;
    const player = this.data.players[index];
    if (!player) return;

    // 保存到历史记录
    this.saveHistory(player.name, this.data.platform, player.id);

    const app = getApp();
    app.globalData.currentPlayer = player;
    app.globalData.currentPlatform = this.data.platform;

    wx.navigateTo({
      url: `/pages/stats/stats?playerId=${player.id}&playerName=${encodeURIComponent(player.name)}&platform=${this.data.platform}`,
    });
  },

  // 从历史记录再次搜索
  onHistoryTap(e) {
    const index = e.currentTarget.dataset.index;
    const item = this.data.searchHistory[index];
    if (!item) return;

    // 直接跳转到战绩页（无需重新搜索）
    wx.navigateTo({
      url: `/pages/stats/stats?playerId=${item.playerId}&playerName=${encodeURIComponent(item.name)}&platform=${item.platform}`,
    });
  },

  // 清除历史记录
  onClearHistory() {
    wx.removeStorageSync(HISTORY_KEY);
    this.setData({ searchHistory: [] });
  },
});