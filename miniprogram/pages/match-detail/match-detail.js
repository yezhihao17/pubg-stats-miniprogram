// pages/match-detail/match-detail.js
const api = require('../../utils/api');

Page({
  data: {
    playerName: '',
    platform: 'steam',
    matchId: '',
    loading: true,
    error: '',

    // 比赛信息
    matchInfo: null,

    // 我的队伍（置顶）
    myTeam: null,

    // 其他队伍
    otherTeams: [],

    // 本局最高伤害
    maxDamage: 0,
  },

  onLoad(options) {
    const { matchId, playerName, platform } = options;
    this.setData({
      matchId,
      playerName: decodeURIComponent(playerName || ''),
      platform,
    });
    this.loadMatchDetail();
  },

  async loadMatchDetail() {
    this.setData({ loading: true, error: '' });

    try {
      const result = await api.getMatchDetail(this.data.platform, this.data.matchId);
      const match = result.match || {};
      const rosters = result.rosters || [];
      const participants = result.participants || [];

      // 构建参与者映射表
      const participantMap = {};
      for (const p of participants) {
        participantMap[p.id] = p;
      }

      // 按队伍分组
      const teams = rosters.map((roster) => {
        const members = (roster.participants || [])
          .map((pid) => participantMap[pid])
          .filter(Boolean);

        const teamKills = members.reduce((sum, m) => sum + (m.stats?.kills || 0), 0);

        return {
          rank: roster.rank,
          won: roster.won,
          teamId: roster.teamId,
          teamKills,
          members: members.map((m) => ({
            id: m.id,
            name: m.name,
            isSelf: m.name === this.data.playerName,
            kills: m.stats?.kills || 0,
            DBNOs: m.stats?.DBNOs || 0,
            damageDealt: m.stats?.damageDealt || 0,
            assists: m.stats?.assists || 0,
            timeSurvived: m.stats?.timeSurvived || 0,
          heals: m.stats?.heals || 0,
          })),
        };
      });

      // 按排名排序
      teams.sort((a, b) => a.rank - b.rank);

      // 找到自己的队伍
      const myTeamIdx = teams.findIndex((t) =>
        t.members.some((m) => m.isSelf)
      );
      const myTeam = myTeamIdx >= 0 ? teams.splice(myTeamIdx, 1)[0] : null;

      // 计算本局最高伤害
      let maxDamage = 0;
      const allTeams = myTeam ? [myTeam, ...teams] : teams;
      for (const team of allTeams) {
        for (const m of team.members) {
          if (m.damageDealt > maxDamage) maxDamage = m.damageDealt;
        }
      }

      // 处理队员数据
      const processMembers = (members) =>
        members.map((m) => ({
          ...m,
          damagePct: maxDamage > 0 ? Math.round((m.damageDealt / maxDamage) * 100) : 0,
          isMaxDamage: m.damageDealt >= maxDamage && maxDamage > 0,
          rating: this._calcRating(m.kills, m.damageDealt, m.timeSurvived),
          survivalStr: this._formatDuration(m.timeSurvived),
          killsStr: `${m.kills}/${m.DBNOs}`,
          damageStr: m.damageDealt.toFixed(2),
        }));

      if (myTeam) {
        myTeam.members = processMembers(myTeam.members);
      }
      for (const team of teams) {
        team.members = processMembers(team.members);
      }

      // 计算本局标签（MVP/医疗兵等）
      if (myTeam) {
        const teamMaxKills = Math.max(...myTeam.members.map(m => m.kills), 0);
        const teamMaxHeals = Math.max(...myTeam.members.map(m => m.heals), 0);
        const mode = match.mode || '';
        const isSolo = mode.includes('solo') && !mode.includes('duo') && !mode.includes('squad');
        const isDuo = mode.includes('duo');
        const dropBoxRank = isSolo ? 90 : isDuo ? 45 : 22;

        // 确定唯一的MVP
        let mvpId = null;
        // 吃鸡队伍有击杀 → 本队击杀最高
        if (myTeam.rank === 1 && teamMaxKills > 0) {
          const sorted = [...myTeam.members].sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt);
          mvpId = sorted[0].id;
        }
        // 吃鸡队伍无击杀 → 全场击杀最高
        if (myTeam.rank === 1 && teamMaxKills === 0) {
          const allMembers = [...myTeam.members];
          for (const team of teams) allMembers.push(...team.members);
          const sorted = allMembers.sort((a, b) => b.kills - a.kills || b.damageDealt - a.damageDealt);
          if (sorted[0].kills > 0) mvpId = sorted[0].id;
        }

        for (const m of myTeam.members) {
          m.isMVP = m.id === mvpId;
          m.isMedic = m.heals >= 200 && m.heals >= teamMaxHeals;
          m.isDropBox = m.timeSurvived > 0 && m.timeSurvived < 120 && m.kills === 0 && myTeam.rank > dropBoxRank;
          m.isCarry = myTeam.rank === 1 && m.kills <= 1 && m.damageDealt < 100;
        }
      }

      // 比赛信息
      const matchInfo = {
        mode: match.mode || '',
        mapName: match.mapName || '',
        duration: match.duration || 0,
        createdAt: match.createdAt || '',
        durationStr: this._formatDuration(match.duration),
        totalTeams: rosters.length,
        totalPlayers: participants.length,
        modeLabel: this._formatMode(match.mode),
        mapLabel: this._formatMap(match.mapName),
        timeStr: this._formatTime(match.createdAt),
      };

      this.setData({
        matchInfo,
        myTeam,
        otherTeams: teams,
        maxDamage,
        loading: false,
      });
    } catch (err) {
      console.error('加载比赛详情失败:', err);
      this.setData({
        error: err.message || '加载比赛数据失败',
        loading: false,
      });
    }
  },

  _calcRating(kills, damage, timeSurvived) {
    const score = kills * 3 + damage * 0.01 + Math.min(timeSurvived / 60, 30) * 0.5;
    if (score >= 60) return 'S+';
    if (score >= 45) return 'S';
    if (score >= 35) return 'A+';
    if (score >= 28) return 'A';
    if (score >= 22) return 'A-';
    if (score >= 17) return 'B+';
    if (score >= 12) return 'B';
    if (score >= 8) return 'B-';
    return 'C';
  },

  _formatMode(mode) {
    const map = {
      solo: '单排', duo: '双排', squad: '四排',
      'solo-fpp': '单排FPP', 'duo-fpp': '双排FPP', 'squad-fpp': '四排FPP',
      'ranked-solo': '排位单排', 'ranked-duo': '排位双排', 'ranked-squad': '排位四排',
      'ranked-solo-fpp': '排位单排FPP', 'ranked-duo-fpp': '排位双排FPP', 'ranked-squad-fpp': '排位四排FPP',
    };
    return map[mode] || mode || '未知';
  },

  _formatMap(mapName) {
    const map = {
      'Erangel_Main': '艾伦格', 'Desert_Main': '米拉玛',
      'Savage_Main': '萨诺', 'DihorOtok_Main': '维寒迪',
      'Tiger_Main': '泰戈', 'Kiki_Main': '帝斯顿',
      'Heaven_Main': '天堂岛', 'Range_Main': '练习场',
    };
    return map[mapName] || mapName || '未知';
  },

  _formatTime(isoString) {
    if (!isoString) return '';
    const d = new Date(isoString);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
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