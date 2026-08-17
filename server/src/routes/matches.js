const express = require('express');
const router = express.Router();
const pubgApi = require('../services/pubg-api');

/**
 * 获取比赛详情
 * GET /api/matches/:matchId?platform=steam
 */
router.get('/:matchId', async (req, res) => {
  try {
    const { platform } = req.query;
    const { matchId } = req.params;

    if (!platform) {
      return res.status(400).json({ error: '缺少必要参数: platform' });
    }

    const data = await pubgApi.getMatchDetail(platform, matchId);

    const match = data.data;
    const included = data.included || [];

    // 比赛基本信息
    const matchInfo = {
      id: match.id,
      type: match.attributes.matchType,
      duration: match.attributes.duration,
      mode: match.attributes.gameMode,
      mapName: match.attributes.mapName,
      isCustom: match.attributes.isCustomMatch,
      seasonState: match.attributes.seasonState,
      createdAt: match.attributes.createdAt,
    };

    // 提取队伍（Roster）— PUBG API 新格式：rank/teamId 在 attributes.stats 中
    const rosters = included
      .filter((item) => item.type === 'roster')
      .map((roster) => ({
        id: roster.id,
        rank: roster.attributes?.stats?.rank,
        teamId: roster.attributes?.stats?.teamId,
        won: roster.attributes?.won === 'true' || roster.attributes?.won === true,
        participants: (roster.relationships?.participants?.data || []).map(
          (p) => p.id
        ),
      }));

    // 提取参赛者详情 — PUBG API 新格式：所有属性在 attributes.stats 中
    const participants = included
      .filter((item) => item.type === 'participant')
      .map((p) => {
        const s = p.attributes?.stats || {};
        return {
          id: p.id,
          name: s.name || '未知',
          stats: {
            kills: s.kills || 0,
            deathType: s.deathType || '',
            killPlace: s.killPlace || 0,
            killStreaks: s.killStreaks || 0,
            damageDealt: s.damageDealt || 0,
            headshotKills: s.headshotKills || 0,
            assists: s.assists || 0,
            revives: s.revives || 0,
            heals: s.heals || 0,
            boosts: s.boosts || 0,
            DBNOs: s.DBNOs || 0,
            longestKill: s.longestKill || 0,
            walkDistance: s.walkDistance || 0,
            rideDistance: s.rideDistance || 0,
            swimDistance: s.swimDistance || 0,
            vehicleDestroys: s.vehicleDestroys || 0,
            timeSurvived: s.timeSurvived || 0,
            winPlace: s.winPlace || 0,
          },
        };
      });

    res.json({
      match: matchInfo,
      rosters,
      participants,
    });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 批量获取比赛详情（用于历史战绩列表）
 * GET /api/matches/batch/list?platform=steam&ids=id1,id2,id3
 */
router.get('/batch/list', async (req, res) => {
  try {
    const { platform, ids } = req.query;

    if (!platform || !ids) {
      return res.status(400).json({ error: '缺少必要参数: platform, ids' });
    }

    const matchIds = ids.split(',').filter(Boolean).slice(0, 20);

    const results = await Promise.allSettled(
      matchIds.map((id) => pubgApi.getMatchDetail(platform, id))
    );

    const matches = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        const match = data.data;
        const included = data.included || [];
        const participants = included.filter(
          (item) => item.type === 'participant'
        );
        const rosters = included.filter(
          (item) => item.type === 'roster'
        );

        // 构建参与者ID到roster的映射（用于获取队伍排名和队伍内数据）
        const participantToRoster = {};
        const rosterToMembers = {};
        for (const roster of rosters) {
          const rosterRank = roster.attributes?.stats?.rank;
          const memberIds = (roster.relationships?.participants?.data || []).map(p => p.id);
          rosterToMembers[roster.id] = [];
          for (const pid of memberIds) {
            participantToRoster[pid] = rosterRank;
            rosterToMembers[roster.id].push(pid);
          }
        }

        matches.push({
          id: match.id,
          createdAt: match.attributes.createdAt,
          duration: match.attributes.duration,
          mode: match.attributes.gameMode,
          mapName: match.attributes.mapName,
          matchType: match.attributes.matchType,
          participants: participants.map((p) => {
            const s = p.attributes?.stats || {};
            // 计算本队最高击杀
            let teamMaxKills = 0;
            for (const [rosterId, memberIds] of Object.entries(rosterToMembers)) {
              if (memberIds.includes(p.id)) {
                for (const mid of memberIds) {
                  const member = participants.find(pp => pp.id === mid);
                  if (member) {
                    const mk = member.attributes?.stats?.kills || 0;
                    if (mk > teamMaxKills) teamMaxKills = mk;
                  }
                }
                break;
              }
            }
            return {
              name: s.name || '未知',
              kills: s.kills || 0,
              killPlace: s.killPlace || 0,
              teamRank: participantToRoster[p.id] || 0,
              teamMaxKills,
              assists: s.assists || 0,
              damageDealt: s.damageDealt || 0,
              heals: s.heals || 0,
              timeSurvived: s.timeSurvived || 0,
              deathType: s.deathType || '',
            };
          }),
        });
      } else {
        matches.push({
          id: matchIds[index],
          error: '获取失败',
        });
      }
    });

    res.json({ matches });
  } catch (err) {
    handleApiError(err, res);
  }
});

function handleApiError(err, res) {
  if (err.response) {
    return res.status(err.response.status).json({
      error: err.response.data?.errors?.[0]?.detail || err.message,
    });
  }
  console.error('PUBG API 错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
}

module.exports = router;