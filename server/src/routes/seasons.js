const express = require('express');
const router = express.Router();
const pubgApi = require('../services/pubg-api');

/**
 * 获取赛季列表
 * GET /api/seasons?platform=steam
 */
router.get('/', async (req, res) => {
  try {
    const { platform } = req.query;

    if (!platform) {
      return res.status(400).json({ error: '缺少必要参数: platform' });
    }

    const data = await pubgApi.getSeasons(platform);

    // 提取赛季信息，标记当前赛季
    const seasons = (data.data || []).map((season) => ({
      id: season.id,
      isCurrent: season.attributes.isCurrentSeason,
      isOffseason: season.attributes.isOffseason,
    }));

    res.json({ seasons });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 获取玩家赛季战绩
 * GET /api/seasons/:seasonId/player/:accountId?platform=steam
 */
router.get('/:seasonId/player/:accountId', async (req, res) => {
  try {
    const { platform } = req.query;
    const { seasonId, accountId } = req.params;

    if (!platform) {
      return res.status(400).json({ error: '缺少必要参数: platform' });
    }

    const data = await pubgApi.getPlayerSeasonStats(platform, accountId, seasonId);

    // 提取关键战绩数据
    const stats = extractStats(data);

    res.json({ stats });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 获取玩家生涯总战绩
 * GET /api/seasons/lifetime/:accountId?platform=steam
 */
router.get('/lifetime/:accountId', async (req, res) => {
  try {
    const { platform } = req.query;
    const { accountId } = req.params;

    if (!platform) {
      return res.status(400).json({ error: '缺少必要参数: platform' });
    }

    const data = await pubgApi.getPlayerLifetimeStats(platform, accountId);

    // 生涯数据按游戏模式分组
    const lifetimeStats = {};
    const gameModeStats = data.data?.attributes?.gameModeStats || {};

    for (const [mode, modeStats] of Object.entries(gameModeStats)) {
      // PUBG API 没有 deaths 字段，用 losses 代替
      if (modeStats.deaths === undefined && modeStats.losses !== undefined) {
        modeStats.deaths = modeStats.losses;
      }
      lifetimeStats[mode] = {
        roundsPlayed: modeStats.roundsPlayed,
        wins: modeStats.wins,
        losses: modeStats.losses,
        kills: modeStats.kills,
        deaths: modeStats.deaths,
        assists: modeStats.assists,
        suicides: modeStats.suicides,
        teamKills: modeStats.teamKills,
        headshotKills: modeStats.headshotKills,
        damageDealt: modeStats.damageDealt,
        dBNOs: modeStats.dBNOs,
        revives: modeStats.revives,
        heals: modeStats.heals,
        boosts: modeStats.boosts,
        walkDistance: modeStats.walkDistance,
        rideDistance: modeStats.rideDistance,
        swimDistance: modeStats.swimDistance,
        longestKill: modeStats.longestKill,
        mostSurvivalTime: modeStats.mostSurvivalTime,
        avgSurvivalTime: modeStats.avgSurvivalTime,
        winPoints: modeStats.winPoints,
        killPoints: modeStats.killPoints,
        // 计算衍生指标
        kdRatio: modeStats.deaths > 0
          ? (modeStats.kills / modeStats.deaths).toFixed(2)
          : modeStats.kills.toFixed(2),
        winRate: modeStats.roundsPlayed > 0
          ? ((modeStats.wins / modeStats.roundsPlayed) * 100).toFixed(1)
          : '0.0',
        top10Rate: modeStats.roundsPlayed > 0
          ? ((modeStats.top10s / modeStats.roundsPlayed) * 100).toFixed(1)
          : '0.0',
      };
    }

    res.json({ lifetimeStats });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 从赛季数据中提取关键指标
 */
function extractStats(data) {
  const matched = data.data?.attributes?.gameModeStats;

  if (!matched) return {};

  // 合并所有模式的统计数据（取总和）
  const merged = {
    roundsPlayed: 0, wins: 0, losses: 0, kills: 0, deaths: 0,
    assists: 0, headshotKills: 0, damageDealt: 0, dBNOs: 0,
    revives: 0, heals: 0, boosts: 0, walkDistance: 0,
    rideDistance: 0, swimDistance: 0, longestKill: 0,
    mostSurvivalTime: 0, top10s: 0,
    winPoints: 0, killPoints: 0,
  };

  const modes = {};

  for (const [mode, stats] of Object.entries(matched)) {
    // PUBG API 没有 deaths 字段，用 losses 代替
    if (stats.deaths === undefined && stats.losses !== undefined) {
      stats.deaths = stats.losses;
    }
    modes[mode] = { ...stats };
    for (const key of Object.keys(merged)) {
      if (typeof stats[key] === 'number') {
        merged[key] += stats[key];
      }
    }
  }

  merged.kdRatio = merged.deaths > 0
    ? (merged.kills / merged.deaths).toFixed(2)
    : merged.kills.toFixed(2);
  merged.winRate = merged.roundsPlayed > 0
    ? ((merged.wins / merged.roundsPlayed) * 100).toFixed(1)
    : '0.0';
  merged.top10Rate = merged.roundsPlayed > 0
    ? ((merged.top10s / merged.roundsPlayed) * 100).toFixed(1)
    : '0.0';

  return { merged, modes };
}

function handleApiError(err, res) {
  if (err.response) {
    const status = err.response.status;
    return res.status(status).json({
      error: err.response.data?.errors?.[0]?.detail || err.message,
    });
  }
  console.error('PUBG API 错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
}

module.exports = router;