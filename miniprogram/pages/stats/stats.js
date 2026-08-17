// pages/stats/stats.js
const api = require('../../utils/api');

// 模式分组配置
const NORMAL_SOLO = ['solo', 'solo-fpp'];
const NORMAL_DUO = ['duo', 'duo-fpp'];
const NORMAL_SQUAD = ['squad', 'squad-fpp'];
const RANKED_SOLO = ['ranked-solo', 'ranked-solo-fpp'];
const RANKED_DUO = ['ranked-duo', 'ranked-duo-fpp'];
const RANKED_SQUAD = ['ranked-squad', 'ranked-squad-fpp'];

Page({
  data: {
    playerId: '',
    playerName: '',
    playerInitial: '',
    platform: 'steam',
    platformLabel: 'Steam / Epic (PC)',
    loading: true,
    error: '',

    // 赛季下拉
    seasonList: [],
    currentSeasonIndex: 0,
    currentSeasonId: '',
    seasonLoading: false,

    // 生涯概要
    summary: null,

    // 当前赛季数据
    currentSeasonSummary: null,

    // 双层 Tab 状态
    typeTab: 'normal', // 'normal' | 'ranked'
    modeTab: 'solo',   // 'solo' | 'duo' | 'squad'

    // 当前显示的详细数据（Tab 切换后更新）
    currentModeData: null,

    // 所有模式原始数据（用于 Tab 切换时快速切换）
    normalModesRaw: {},
    rankedModesRaw: {},

    matchIds: [],
    matchTotal: 0,
  },

  onLoad(options) {
    const { playerId, playerName, platform } = options;
    const platformLabels = {
      steam: 'Steam / Epic (PC)',
      kakao: 'Kakao (PC-韩服)',
      xbox: 'Xbox',
      psn: 'PlayStation',
    };
    const decodedName = decodeURIComponent(playerName || '');

    this.setData({
      playerId,
      playerName: decodedName,
      playerInitial: decodedName ? decodedName.charAt(0).toUpperCase() : '?',
      platform,
      platformLabel: platformLabels[platform] || platform,
    });

    this.loadData();
  },

  async loadData() {
    this.setData({ loading: true, error: '' });

    try {
      const [seasonResult, lifetimeResult, playerResult] = await Promise.all([
        api.getSeasons(this.data.platform),
        api.getLifetimeStats(this.data.platform, this.data.playerId),
        api.getPlayerDetail(this.data.platform, this.data.playerId),
      ]);

      // 赛季列表
      const rawSeasons = (seasonResult.seasons || []).filter((s) => !s.isOffseason);
      const seasonList = rawSeasons.map((s) => ({
        id: s.id,
        isCurrent: s.isCurrent,
        label: this._formatSeasonName(s.id),
      }));
      const currentIdx = rawSeasons.findIndex((s) => s.isCurrent);
      const currentSeasonIndex = currentIdx >= 0 ? currentIdx : 0;
      const currentSeasonId = seasonList[currentSeasonIndex]?.id || '';

      // 生涯数据
      const lifetimeStats = lifetimeResult.lifetimeStats || {};
      const rawModes = lifetimeStats.modes || {};

      // 计算生涯概要
      const summary = this._calcSummary(rawModes);

      // 分离匹配/排位模式原始数据
      const normalModesRaw = {};
      const rankedModesRaw = {};
      for (const [key, val] of Object.entries(rawModes)) {
        if (key.startsWith('ranked-')) {
          rankedModesRaw[key] = val;
        } else {
          normalModesRaw[key] = val;
        }
      }

      this.setData({
        seasonList,
        currentSeasonIndex,
        currentSeasonId,
        summary,
        normalModesRaw,
        rankedModesRaw,
        matchIds: playerResult.matchIds || [],
        matchTotal: (playerResult.matchIds || []).length,
        loading: false,
      });

      // 加载当前赛季的数据
      this.loadSeasonData(currentSeasonId);

    } catch (err) {
      this.setData({
        error: err.message || '加载数据失败',
        loading: false,
      });
    }
  },

  async loadSeasonData(seasonId) {
    if (!seasonId) return;
    this.setData({ seasonLoading: true });

    try {
      const result = await api.getSeasonStats(
        this.data.platform,
        seasonId,
        this.data.playerId
      );

      // 后端返回 { stats: { merged, modes } }
      const seasonStats = result.stats || {};
      const rawModes = seasonStats.modes || {};

      // 计算赛季概要
      const currentSeasonSummary = this._calcSummary(rawModes);

      // 分离匹配/排位
      const normalModesRaw = {};
      const rankedModesRaw = {};
      for (const [key, val] of Object.entries(rawModes)) {
        if (key.startsWith('ranked-')) {
          rankedModesRaw[key] = val;
        } else {
          normalModesRaw[key] = val;
        }
      }

      this.setData({
        currentSeasonSummary,
        normalModesRaw,
        rankedModesRaw,
        seasonLoading: false,
      });

      // 更新当前 Tab 显示
      this._updateCurrentModeData();

    } catch (err) {
      console.error('加载赛季数据失败:', err);
      this.setData({
        currentSeasonSummary: null,
        seasonLoading: false,
      });
    }
  },

  // 切换赛季
  onSeasonChange(e) {
    const index = parseInt(e.detail.value, 10);
    const seasonId = this.data.seasonList[index]?.id;
    this.setData({ currentSeasonIndex: index, currentSeasonId: seasonId });
    if (seasonId) {
      this.loadSeasonData(seasonId);
    }
  },

  // 切换匹配/排位 Tab
  onTypeTabChange(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ typeTab: type });
    this._updateCurrentModeData();
  },

  // 切换模式 Tab（单排/双排/四排）
  onModeTabChange(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ modeTab: mode });
    this._updateCurrentModeData();
  },

  // 根据当前 Tab 状态更新显示数据
  _updateCurrentModeData() {
    const { typeTab, modeTab, normalModesRaw, rankedModesRaw } = this.data;

    const rawModes = typeTab === 'normal' ? normalModesRaw : rankedModesRaw;

    const modeConfigs = {
      solo: { modes: ['solo', 'solo-fpp'], label: '单排' },
      duo: { modes: ['duo', 'duo-fpp'], label: '双排' },
      squad: { modes: ['squad', 'squad-fpp'], label: '四排' },
    };

    // 如果是排位，加上 ranked- 前缀
    let actualModes;
    if (typeTab === 'ranked') {
      actualModes = modeConfigs[modeTab].modes.map(m => `ranked-${m}`);
    } else {
      actualModes = modeConfigs[modeTab].modes;
    }

    // 合并 TPP + FPP 数据
    let roundsPlayed = 0, wins = 0, kills = 0, deaths = 0;
    let damageDealt = 0, assists = 0, top10s = 0;
    let headshotKills = 0, longestKill = 0, revives = 0;
    let heals = 0, boosts = 0, DBNOs = 0;

    for (const modeKey of actualModes) {
      const s = rawModes[modeKey];
      if (s) {
        roundsPlayed += s.roundsPlayed || 0;
        wins += s.wins || 0;
        kills += s.kills || 0;
        deaths += s.deaths || 0;
        damageDealt += s.damageDealt || 0;
        assists += s.assists || 0;
        top10s += s.top10s || 0;
        headshotKills += s.headshotKills || 0;
        longestKill = Math.max(longestKill, s.longestKill || 0);
        revives += s.revives || 0;
        heals += s.heals || 0;
        boosts += s.boosts || 0;
        DBNOs += s.dBNOs || 0;
      }
    }

    const kdRatio = deaths > 0 ? (kills / deaths).toFixed(2) : String(kills);
    const winRate = roundsPlayed > 0 ? ((wins / roundsPlayed) * 100).toFixed(1) : '0.0';
    const avgDamage = roundsPlayed > 0 ? Math.round(damageDealt / roundsPlayed) : 0;
    const avgKills = roundsPlayed > 0 ? (kills / roundsPlayed).toFixed(2) : '0.00';

    const typeLabel = typeTab === 'normal' ? '匹配' : '排位';
    const modeLabel = modeConfigs[modeTab].label;

    this.setData({
      currentModeData: {
        typeLabel,
        modeLabel,
        kdRatio,
        winRate: winRate + '%',
        roundsPlayed: this._fmt(roundsPlayed),
        avgDamage: this._fmt(avgDamage),
        avgKills,
        kills: this._fmt(kills),
        deaths: this._fmt(deaths),
        wins: this._fmt(wins),
        assists: this._fmt(assists),
        damageDealt: this._fmt(damageDealt),
        headshotKills: this._fmt(headshotKills),
        longestKill: longestKill ? Math.round(longestKill) + 'm' : '0m',
        revives: this._fmt(revives),
        heals: this._fmt(heals),
        boosts: this._fmt(boosts),
        DBNOs: this._fmt(DBNOs),
        top10s: this._fmt(top10s),
      },
    });
  },

  // 计算总体概要
  _calcSummary(rawModes) {
    let totalRounds = 0, totalWins = 0, totalKills = 0, totalDeaths = 0;
    let totalDamage = 0;

    for (const stats of Object.values(rawModes)) {
      totalRounds += stats.roundsPlayed || 0;
      totalWins += stats.wins || 0;
      totalKills += stats.kills || 0;
      totalDeaths += stats.deaths || 0;
      totalDamage += stats.damageDealt || 0;
    }

    if (totalRounds === 0) return null;

    const kdRatio = totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : String(totalKills);
    const winRate = ((totalWins / totalRounds) * 100).toFixed(1);
    const avgDamage = Math.round(totalDamage / totalRounds);
    const avgKills = (totalKills / totalRounds).toFixed(2);

    return {
      kdRatio,
      winRate,
      roundsPlayed: this._fmt(totalRounds),
      wins: this._fmt(totalWins),
      avgDamage: this._fmt(avgDamage),
      avgKills,
    };
  },

  onViewMatches() {
    wx.navigateTo({
      url: `/pages/matches/matches?playerId=${this.data.playerId}&playerName=${encodeURIComponent(this.data.playerName)}&platform=${this.data.platform}`,
    });
  },

  _formatSeasonName(seasonId) {
    const m = seasonId.match(/(\d{4}-\d{2})/);
    return m ? `赛季 ${m[1]}` : seasonId.substring(0, 16);
  },

  _fmt(num) {
    if (num == null) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
  },
});