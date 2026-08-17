const express = require('express');
const router = express.Router();
const pubgApi = require('../services/pubg-api');

/**
 * 搜索玩家
 * GET /api/players/search?platform=steam&name=playerName
 */
router.get('/search', async (req, res) => {
  try {
    const { platform, name } = req.query;

    if (!platform || !name) {
      return res.status(400).json({
        error: '缺少必要参数: platform, name',
      });
    }

    if (!pubgApi.hasApiKey()) {
      return res.status(503).json({
        error: '服务未配置 API Key，请先在 .env 中设置 PUBG_API_KEY',
      });
    }

    const data = await pubgApi.searchPlayers(platform, name.trim());

    // 简化返回数据
    const players = (data.data || []).map((player) => ({
      id: player.id,
      name: player.attributes.name,
      platform: platform,
      avatar: null, // PUBG API 不直接提供头像
    }));

    res.json({ players });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 获取玩家详情（含关联的比赛列表）
 * GET /api/players/:id?platform=steam
 */
router.get('/:id', async (req, res) => {
  try {
    const { platform } = req.query;
    const { id } = req.params;

    if (!platform) {
      return res.status(400).json({ error: '缺少必要参数: platform' });
    }

    const data = await pubgApi.getPlayerById(platform, id);

    // 提取比赛 ID 列表
    const matchIds = (data.data?.relationships?.matches?.data || []).map(
      (m) => m.id
    );

    res.json({
      player: {
        id: data.data.id,
        name: data.data.attributes.name,
        platform,
      },
      matchIds,
    });
  } catch (err) {
    handleApiError(err, res);
  }
});

/**
 * 错误处理
 */
function handleApiError(err, res) {
  if (err.response) {
    const status = err.response.status;
    const message = err.response.data?.errors?.[0]?.detail || err.message;

    if (status === 401 || status === 403) {
      return res.status(status).json({
        error: 'API Key 无效或未授权，请检查 PUBG_API_KEY 配置',
      });
    }
    if (status === 429) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试（PUBG API 限流）',
      });
    }
    if (status === 404) {
      return res.status(404).json({ error: '未找到该玩家' });
    }

    return res.status(status).json({ error: message });
  }

  if (err.code === 'ECONNABORTED') {
    return res.status(504).json({ error: 'PUBG API 请求超时' });
  }

  console.error('PUBG API 错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
}

module.exports = router;