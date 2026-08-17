const http = require('http');
const playerId = 'account.0ef2ad0a870342da83f5f701dc1e9107';

http.get(`http://localhost:3000/api/players/${playerId}?platform=steam`, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const ids = (parsed.matchIds || []).slice(0, 1);
    if (ids.length === 0) { console.log('No matches'); return; }
    
    http.get(`http://localhost:3000/api/matches/${ids[0]}?platform=steam`, (res2) => {
      let d2 = '';
      res2.on('data', c => d2 += c);
      res2.on('end', () => {
        const detail = JSON.parse(d2);
        const rosters = detail.rosters || [];
        const participants = detail.participants || [];
        
        // 找到 itdoth_ 和其队伍
        const me = participants.find(p => p.name === 'itdoth_');
        const myRoster = rosters.find(r => r.participants.includes(me?.id));
        
        console.log('Me:', me?.name, 'kills:', me?.stats?.kills, 'damage:', me?.stats?.damageDealt);
        console.log('My team rank:', myRoster?.rank);
        
        // 计算本队最高击杀
        if (myRoster) {
          const teamMembers = myRoster.participants.map(pid => participants.find(p => p.id === pid)).filter(Boolean);
          const maxKills = Math.max(...teamMembers.map(m => m.stats?.kills || 0));
          console.log('Team max kills:', maxKills);
          console.log('isMVP:', me?.stats?.kills > 0 && me?.stats?.kills >= maxKills && myRoster?.rank === 1);
          console.log('Team members:', teamMembers.map(m => m.name + ':' + m.stats?.kills));
        }
        
        // 计算全场比赛最高击杀
        const allMaxKills = Math.max(...participants.map(p => p.stats?.kills || 0));
        console.log('All match max kills:', allMaxKills);
      });
    });
  });
});