// pages/matches/matches.js
const api = require('../../utils/api');
const PAGE_SIZE = 10;

const MODE_MAP = {
  solo: '单排', duo: '双排', squad: '四排',
  'solo-fpp': '单排FPP', 'duo-fpp': '双排FPP', 'squad-fpp': '四排FPP',
  'ranked-solo': '排位单排', 'ranked-duo': '排位双排', 'ranked-squad': '排位四排',
};

const MAP_MAP = {
  'Erangel_Main': '艾伦格', 'Desert_Main': '米拉玛',
  'Savage_Main': '萨诺', 'DihorOtok_Main': '维寒迪',
  'Tiger_Main': '泰戈', 'Kiki_Main': '帝斯顿',
  'Heaven_Main': '天堂岛', 'Baltic_Main': '艾伦格',
};

Page({
  data: {
    playerName: '',
    platform: 'steam',
    allMatchIds: [],
    matchList: [],
    filteredMatchList: [],
    matchTotal: 0,
    loading: true,
    loadingMore: false,
    hasMore: true,
    error: '',
    filterTab: 'all',
  },

  onLoad(options) {
    const { playerId, playerName, platform } = options;
    this.setData({
      playerId,
      playerName: decodeURIComponent(playerName || ''),
      platform,
    });
    this.loadMatchIds();
  },

  async loadMatchIds() {
    this.setData({ loading: true, error: '' });
    try {
      const playerResult = await api.getPlayerDetail(this.data.platform, this.data.playerId);
      const allMatchIds = playerResult.matchIds || [];
      this.setData({ allMatchIds, matchTotal: allMatchIds.length });

      if (allMatchIds.length === 0) {
        this.setData({ loading: false, hasMore: false });
        return;
      }

      // 加载第一页数据
      await this._loadMore(allMatchIds, 0, PAGE_SIZE);
      this.setData({ loading: false });
    } catch (err) {
      this.setData({ error: err.message || '加载比赛数据失败', loading: false });
    }
  },

  // 加载更多
  onLoadMore() {
    if (this.data.loadingMore || !this.data.hasMore) return;
    const { allMatchIds, matchList } = this.data;
    const start = matchList.length;
    this._loadMore(allMatchIds, start, start + PAGE_SIZE);
  },

  // 上拉加载更多（微信自动触发）
  onReachBottom() {
    this.onLoadMore();
  },

  async _loadMore(allIds, start, end) {
    const batch = allIds.slice(start, end);
    if (batch.length === 0) {
      this.setData({ hasMore: false });
      return;
    }

    this.setData({ loadingMore: true });

    try {
      const matchResult = await api.getMatchBatch(this.data.platform, batch);
      const playerName = this.data.playerName;

      const newMatches = (matchResult.matches || []).map((match) => {
        const playerStats = (match.participants || []).find((p) => p.name === playerName);
        const mode = match.mode || '';
        const isRanked = mode.startsWith('ranked-');
        const kills = playerStats?.kills || 0;
        const killPlace = playerStats?.killPlace || 0;
        const damageDealt = playerStats?.damageDealt || 0;
        const assists = playerStats?.assists || 0;
        const timeSurvived = playerStats?.timeSurvived || 0;
        const heals = playerStats?.heals || 0;
        const isWin = killPlace === 1;
        const teamRank = playerStats?.teamRank || 0;
        const displayRank = teamRank || killPlace;

        // 计算标签
        const allParticipants = match.participants || [];
        const teamMaxKills = playerStats?.teamMaxKills || 0;
        const maxHeals = Math.max(...allParticipants.map(p => p.heals || 0), 0);
        // MVP：吃鸡队伍内击杀最高者
        let isMVP = false;
        if (displayRank === 1) {
          const winningTeam = allParticipants.filter(p => (p.teamRank || 0) === 1);
          winningTeam.sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt);
          isMVP = playerStats && playerStats.kills > 0 && playerStats.name === winningTeam[0].name;
        }
        const isMedic = heals > 0 && heals >= maxHeals;
        const isSolo = mode.includes('solo') && !mode.includes('duo') && !mode.includes('squad');
        const isDuo = mode.includes('duo');
        const dropBoxRank = isSolo ? 90 : isDuo ? 45 : 22;
        const isDropBox = timeSurvived > 0 && timeSurvived < 120 && kills === 0 && displayRank > dropBoxRank;
        const isCarry = displayRank === 1 && kills <= 1 && damageDealt < 100;

        return {
          id: match.id,
          error: match.error,
          mode,
          modeName: MODE_MAP[mode] || this._formatMode(mode),
          mapName: MAP_MAP[match.mapName] || match.mapName || '未知',
          isRanked,
          isWin: displayRank === 1,
          kills,
          killPlace: displayRank,
          damageDealt,
          damageStr: damageDealt.toFixed(2),
          assists,
          heals,
          survivalStr: this._formatDuration(timeSurvived),
          isMVP,
          isMedic,
          isDropBox,
          isCarry,
          createdAt: match.createdAt,
          timeAgo: this._formatTime(match.createdAt),
          duration: match.duration,
          durationStr: this._formatDuration(match.duration),
        };
      });

      const matchList = [...this.data.matchList, ...newMatches];
      const hasMore = allIds.length > matchList.length;

      this.setData({ matchList, loadingMore: false, hasMore });
      this._updateFilteredList();
    } catch (err) {
      this.setData({ loadingMore: false });
    }
  },

  onFilterChange(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ filterTab: tab });
    this._updateFilteredList();
  },

  _updateFilteredList() {
    const { matchList, filterTab } = this.data;
    let filtered = matchList;
    if (filterTab === 'normal') filtered = matchList.filter((m) => !m.isRanked);
    else if (filterTab === 'ranked') filtered = matchList.filter((m) => m.isRanked);
    this.setData({ filteredMatchList: filtered });
  },

  onViewMatchDetail(e) {
    const index = e.currentTarget.dataset.index;
    const match = this.data.filteredMatchList[index];
    if (!match || match.error) return;
    wx.navigateTo({
      url: `/pages/match-detail/match-detail?matchId=${match.id}&playerName=${encodeURIComponent(this.data.playerName)}&platform=${this.data.platform}`,
    });
  },

  _formatMode(mode) {
    const parts = mode.replace('ranked-', '').split('-');
    const base = parts[0];
    const fpp = parts.includes('fpp') ? 'FPP' : '';
    const modeLabels = { solo: '单排', duo: '双排', squad: '四排' };
    const ranked = mode.startsWith('ranked-') ? '排位' : '';
    return `${ranked}${modeLabels[base] || base} ${fpp}`.trim();
  },

  _formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    const now = new Date();
    const diff = now - d;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}天前`;
    return `${d.getMonth() + 1}/${d.getDate()}`;
  },

  _formatDuration(seconds) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  },

  _formatNumber(num) {
    if (num == null) return '0';
    if (num >= 10000) return (num / 10000).toFixed(1) + 'w';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return String(num);
  },
});