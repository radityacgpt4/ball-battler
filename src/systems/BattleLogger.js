/**
 * Battle Data Logger
 * Tracks in-memory battle stats and exports CSV for character balancing
 */
export class BattleLogger {
    constructor() {
        this.battleHistory = [];
        this.currentBattle = null;
        this.frameCounter = 0;
        this.intervalFrames = 300; // 5s at 60fps
        this.secondFrameCounter = 0;
        this._lastSecondSnapshot = null;
    }

    startBattle(entities) {
        this.frameCounter = 0;
        this.secondFrameCounter = 0;
        this.currentBattle = {
            timestamp: new Date().toISOString(),
            startTime: performance.now(),
            entities: entities,
            intervals: [],
            secondSnapshots: [],
            winner: null,
            duration: 0
        };

        // Snapshot initial stats for interval deltas
        this._lastSnapshot = this._snapshotStats(entities);
        this._lastSecondSnapshot = this._snapshotStats(entities);
    }

    recordInterval(entities) {
        if (!this.currentBattle) return;

        this.frameCounter++;

        // Per-second DPS tracking (every 60 frames)
        this.secondFrameCounter++;
        if (this.secondFrameCounter >= 60) {
            this.secondFrameCounter = 0;
            const currentSnap = this._snapshotStats(entities);
            const secondIndex = this.currentBattle.secondSnapshots.length;
            const fighters = [];

            for (const ent of entities) {
                const curr = currentSnap.get(ent);
                const prev = this._lastSecondSnapshot ? this._lastSecondSnapshot.get(ent) : null;
                const dmgThisSecond = prev ? (curr.damageDealt - prev.damageDealt) : curr.damageDealt;
                fighters.push({ name: ent.name, type: ent.typeKey, dmgThisSecond: Math.round(dmgThisSecond) });
            }

            this.currentBattle.secondSnapshots.push({ second: secondIndex, fighters });
            this._lastSecondSnapshot = currentSnap;
        }

        if (this.frameCounter % this.intervalFrames !== 0) return;

        const intervalIndex = this.frameCounter / this.intervalFrames;
        const currentSnapshot = this._snapshotStats(entities);

        for (const ent of entities) {
            const prev = this._lastSnapshot.get(ent);
            const curr = currentSnapshot.get(ent);
            if (!prev || !curr) continue;

            this.currentBattle.intervals.push({
                interval: intervalIndex,
                fighter: ent.name,
                team: ent.id,
                hp: Math.ceil(ent.hp),
                dmgDealtInterval: curr.damageDealt - prev.damageDealt,
                dmgReceivedInterval: curr.damageReceived - prev.damageReceived,
                cumulativeDealt: curr.damageDealt,
                cumulativeReceived: curr.damageReceived
            });
        }

        this._lastSnapshot = currentSnapshot;
    }

    _snapshotStats(entities) {
        const map = new Map();
        for (const ent of entities) {
            if (!ent.battleStats) continue;
            map.set(ent, {
                damageDealt: ent.battleStats.damageDealt,
                damageReceived: ent.battleStats.damageReceived
            });
        }
        return map;
    }

    endBattle(winner, entities) {
        if (!this.currentBattle) return;

        this.currentBattle.winner = winner;
        this.currentBattle.duration = ((performance.now() - this.currentBattle.startTime) / 1000).toFixed(1);

        // Store final fighter data
        this.currentBattle.fighters = entities.map(ent => {
            const stats = ent.battleStats || {};
            // Find top damage ability
            let topAbility = '-';
            let topAmount = 0;
            if (stats.damageByAbility) {
                for (const [name, dmg] of Object.entries(stats.damageByAbility)) {
                    if (dmg > topAmount) { topAbility = name; topAmount = dmg; }
                }
            }

            return {
                team: ent.id,
                name: ent.name,
                type: ent.typeKey,
                finalHp: Math.ceil(ent.hp),
                maxHp: ent.maxHp,
                status: ent.isDead ? 'DEAD' : 'ALIVE',
                dmgDealt: Math.round(stats.damageDealt || 0),
                dmgReceived: Math.round(stats.damageReceived || 0),
                dmgBlocked: Math.round(stats.damageBlocked || 0),
                kills: stats.kills || 0,
                healing: Math.round(stats.healingDone || 0),
                atkUsed: (stats.abilityUsage && stats.abilityUsage.atk) || 0,
                defUsed: (stats.abilityUsage && stats.abilityUsage.def) || 0,
                ultUsed: (stats.abilityUsage && stats.abilityUsage.ult) || 0,
                topAbility,
                topAmount: Math.round(topAmount)
            };
        });

        const team1Alive = entities.filter(e => !e.isDead && e.id === 1).length;
        const team2Alive = entities.filter(e => !e.isDead && e.id === 2).length;
        this.currentBattle.team1Survivors = team1Alive;
        this.currentBattle.team2Survivors = team2Alive;

        this.battleHistory.push(this.currentBattle);
        this.currentBattle = null;
    }

    getBattleCount() {
        return this.battleHistory.length;
    }

    generateCSV() {
        const lines = [];

        // Section 1: Battle Summary
        lines.push('=== BATTLE SUMMARY ===');
        lines.push('Timestamp,Winner,Duration(s),Team1_Survivors,Team2_Survivors');
        for (const b of this.battleHistory) {
            lines.push(`${b.timestamp},${b.winner},${b.duration},${b.team1Survivors},${b.team2Survivors}`);
        }

        lines.push('');

        // Section 2: Fighter Stats
        lines.push('=== FIGHTER STATS ===');
        lines.push('Timestamp,Team,Fighter,Type,Final_HP,Max_HP,Status,Dmg_Dealt,Dmg_Received,Dmg_Blocked,Kills,Healing,ATK_Used,DEF_Used,ULT_Used,Top_Damage_Ability,Top_Damage_Amount');
        for (const b of this.battleHistory) {
            for (const f of b.fighters) {
                lines.push(`${b.timestamp},${f.team},${f.name},${f.type},${f.finalHp},${f.maxHp},${f.status},${f.dmgDealt},${f.dmgReceived},${f.dmgBlocked},${f.kills},${f.healing},${f.atkUsed},${f.defUsed},${f.ultUsed},${f.topAbility},${f.topAmount}`);
            }
        }

        lines.push('');

        // Section 3: Timeline
        lines.push('=== TIMELINE (5s intervals) ===');
        lines.push('Timestamp,Interval,Fighter,Team,HP,Dmg_Dealt_Interval,Dmg_Received_Interval,Cumulative_Dealt,Cumulative_Received');
        for (const b of this.battleHistory) {
            for (const iv of b.intervals) {
                lines.push(`${b.timestamp},${iv.interval},${iv.fighter},${iv.team},${iv.hp},${iv.dmgDealtInterval},${iv.dmgReceivedInterval},${iv.cumulativeDealt},${iv.cumulativeReceived}`);
            }
        }

        return lines.join('\n');
    }

    downloadCSV() {
        const csv = this.generateCSV();
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `battle-data-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

export function trackTowerDamage(tower, damage, attacker) {
    tower.hp -= damage;
    const owner = tower.owner;
    if (attacker && attacker.battleStats) {
        attacker.battleStats.damageDealt += damage;
    }
    if (owner && owner.battleStats) {
        owner.battleStats.damageReceived += damage;
        const srcName = (attacker && attacker.name) || 'Unknown';
        owner.battleStats.damageTakenBySource[srcName] =
            (owner.battleStats.damageTakenBySource[srcName] || 0) + damage;
    }
    if (tower.hp <= 0 && attacker && attacker.battleStats) {
        attacker.battleStats.kills++;
    }
}

export const battleLogger = new BattleLogger();
