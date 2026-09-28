let tg = window.Telegram ? window.Telegram.WebApp : null;
try { if (tg) tg.expand(); } catch(e) {}

const defaultState = {
    level: 1, exp: 0, gold: 0, statPoints: 0,
    stats: { str: 10, agi: 10, int: 10 },
    shadows: { infantry: 0, knight: 0, mage: 0 },
    equipment: { weaponLevel: 0 },
    monsterLevel: 1, monsterHp: 50
};

let game = null;

const monstersData = [
    { name: "Слабкий Гоблін", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Goblin.png" },
    { name: "Синій Вовк", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Wolf.png" },
    { name: "Вищий Орк", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Ogre.png" },
    { name: "Король Демонів", img: "https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Skull.png" }
];

const shadowsData = {
    infantry: { name: "Тінь-Піхотинець", baseCost: 50, dps: 2 },
    knight: { name: "Тінь-Лицар", baseCost: 500, dps: 15 },
    mage: { name: "Ігріс", baseCost: 5000, dps: 100 }
};

const weaponData = [
    { name: "Зламаний Кинджал", cost: 100, multiplier: 1.5 },
    { name: "Ікло Касаки", cost: 1000, multiplier: 3.0 },
    { name: "Вбивця Лицарів", cost: 5000, multiplier: 8.0 },
    { name: "Гнів Короля Демонів", cost: 25000, multiplier: 20.0 }
];

let monster = { level: 1, maxHp: 50, hp: 50 };

// --- АВТОРЕЄСТРАЦІЯ (TELEGRAM ПРОФІЛЬ) ---
function loadTelegramProfile() {
    let playerName = "Мисливець";
    let avatarUrl = "https://placehold.co/100/1e3a8a/white?text=S";
    
    // Якщо гра відкрита в Telegram, беремо дані користувача
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) {
        const user = tg.initDataUnsafe.user;
        playerName = user.first_name || user.username || "Мисливець";
        if (user.photo_url) {
            avatarUrl = user.photo_url;
        }
    }
    
    document.getElementById('player-name').innerText = playerName;
    document.getElementById('player-avatar').src = avatarUrl;
}

// --- СИСТЕМА РАНГІВ ---
function getPlayerRankInfo(level) {
    if (level < 10) return { name: "Ранг E", class: "rank-e" };
    if (level < 25) return { name: "Ранг D", class: "rank-d" };
    if (level < 50) return { name: "Ранг C", class: "rank-c" };
    if (level < 75) return { name: "Ранг B", class: "rank-b" };
    if (level < 100) return { name: "Ранг A", class: "rank-a" };
    return { name: "Ранг S", class: "rank-s" };
}

function initGame() {
    let isStarted = false;
    
    function start() {
        if (isStarted) return;
        isStarted = true;
        
        loadTelegramProfile(); // Підтягуємо профіль

        if (!game) {
            try { game = JSON.parse(localStorage.getItem('soloSave')) || JSON.parse(JSON.stringify(defaultState)); } 
            catch(e) { game = JSON.parse(JSON.stringify(defaultState)); }
        }
        
        if (!game.monsterLevel) game.monsterLevel = game.level;
        if (!game.monsterHp) game.monsterHp = Math.floor(50 * Math.pow(1.5, game.monsterLevel - 1));

        startGameLoop();
    }

    try {
        if (tg && tg.CloudStorage) {
            tg.CloudStorage.getItem('soloSave', function(err, val) {
                if (!err && val) { try { game = JSON.parse(val); } catch(e) {} }
                start();
            });
            setTimeout(start, 1000);
        } else {
            start();
        }
    } catch (error) {
        start();
    }
}

function startGameLoop() {
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('game-container').style.display = 'flex';
    
    monster.level = game.monsterLevel;
    monster.hp = game.monsterHp;
    
    setMonsterData();
    updateUI();

    setInterval(() => {
        let dps = getShadowDPS();
        if (dps > 0) dealDamage(Math.max(1, dps / 10), false);
    }, 100);

    setInterval(saveGame, 5000);
}

function saveGame() {
    if (!game) return;
    game.monsterLevel = monster.level;
    game.monsterHp = monster.hp;
    const dataStr = JSON.stringify(game);
    localStorage.setItem('soloSave', dataStr);
    try { if (tg && tg.CloudStorage) tg.CloudStorage.setItem('soloSave', dataStr); } catch(e) {}
}

function setMonsterData() {
    monster.maxHp = Math.floor(50 * Math.pow(1.5, monster.level - 1));
    if (monster.hp <= 0) monster.hp = monster.maxHp;
    
    let mIndex = (monster.level - 1) % monstersData.length;
    document.getElementById('monster-name').innerText = `[Lv.${monster.level}] ${monstersData[mIndex].name}`;
    document.getElementById('monster-sprite').src = monstersData[mIndex].img;
}

function getClickDamage() {
    let baseDmg = game.stats.str * 2;
    let weaponMult = game.equipment.weaponLevel > 0 ? weaponData[game.equipment.weaponLevel - 1].multiplier : 1;
    return Math.floor(baseDmg * weaponMult);
}

function getCritChance() { return Math.min(game.stats.agi * 0.5, 50); }
function getShadowDPS() {
    let dps = game.shadows.infantry * shadowsData.infantry.dps + game.shadows.knight * shadowsData.knight.dps + game.shadows.mage * shadowsData.mage.dps;
    return Math.floor(dps * (1 + (game.stats.int - 10) * 0.02));
}

function attackMonster(event) {
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('light'); } catch(e) {} }
    
    let dmg = getClickDamage();
    let isCrit = Math.random() * 100 < getCritChance();
    if (isCrit) {
        dmg *= 2;
        if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.impactOccurred('heavy'); } catch(e) {} }
    }

    dealDamage(dmg, true);
    
    let rect = document.getElementById('monster-container').getBoundingClientRect();
    let x = event.clientX ? event.clientX - rect.left : rect.width / 2;
    let y = event.clientY ? event.clientY - rect.top : rect.height / 2;
    
    showDamageText(x, y, dmg, isCrit);
    createSlashEffect(x, y);
    
    const sprite = document.getElementById('monster-sprite');
    sprite.classList.remove('hit-shake');
    void sprite.offsetWidth; 
    sprite.classList.add('hit-shake');
}

function dealDamage(amount, isClick) {
    monster.hp -= amount;
    if (monster.hp <= 0) {
        monsterDefeated();
    } else {
        updateMonsterHPUI();
    }
}

function updateMonsterHPUI() {
    let hpPercent = Math.max(0, (monster.hp / monster.maxHp) * 100);
    document.getElementById('monster-hp-bar').style.width = `${hpPercent}%`;
    document.getElementById('monster-hp-text').innerText = `${Math.floor(Math.max(0, monster.hp))} / ${monster.maxHp}`;
}

function monsterDefeated() {
    if (tg && tg.HapticFeedback) { try { tg.HapticFeedback.notificationOccurred('success'); } catch(e) {} }
    game.exp += 20 * monster.level;
    game.gold += 5 * monster.level;
    checkLevelUp();
    
    monster.level += 1;
    monster.hp = 0; 
    
    setMonsterData();
    saveGame();
    updateUI();
}

function checkLevelUp() {
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    let leveledUp = false;
    while (game.exp >= maxExp) {
        game.exp -= maxExp;
        game.level++;
        game.statPoints += 3;
        maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
        leveledUp = true;
    }
    if (leveledUp) {
        // Якщо ранг змінився, ми це побачимо при оновленні UI
    }
}

function upgradeStat(stat) {
    if (game.statPoints > 0) { game.stats[stat]++; game.statPoints--; updateUI(); saveGame(); }
}

function buyShadow(type) {
    let cost = Math.floor(shadowsData[type].baseCost * Math.pow(1.15, game.shadows[type]));
    if (game.gold >= cost) { game.gold -= cost; game.shadows[type]++; updateUI(); saveGame(); }
}

function buyWeapon() {
    let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep && game.gold >= nextWep.cost) { game.gold -= nextWep.cost; game.equipment.weaponLevel++; updateUI(); saveGame(); }
}

function showDamageText(x, y, dmg, isCrit) {
    const container = document.getElementById('monster-container');
    const text = document.createElement('div');
    text.className = `damage-text ${isCrit ? 'crit-text' : ''}`;
    text.innerText = dmg;
    
    let offsetX = (Math.random() - 0.5) * 60;
    text.style.left = `${x + offsetX}px`;
    text.style.top = `${y - 20}px`;
    
    container.appendChild(text);
    setTimeout(() => text.remove(), 800);
}

function createSlashEffect(x, y) {
    const container = document.getElementById('monster-container');
    const slash = document.createElement('div');
    slash.className = 'slash-effect';
    slash.style.left = `${x - 50}px`;
    slash.style.top = `${y}px`;
    
    let angle = Math.random() * 360;
    slash.style.transform = `rotate(${angle}deg)`;
    
    container.appendChild(slash);
    setTimeout(() => slash.remove(), 150);
}

function switchTab(tabId) {
    document.getElementById('tab-shadows').style.display = tabId === 'shadows' ? 'block' : 'none';
    document.getElementById('tab-equipment').style.display = tabId === 'equipment' ? 'block' : 'none';
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

function renderShop() {
    let shadowsHTML = '';
    for (const [key, data] of Object.entries(shadowsData)) {
        let cost = Math.floor(data.baseCost * Math.pow(1.15, game.shadows[key]));
        shadowsHTML += `<div class="shop-item"><div class="shop-item-info"><h4>${data.name} [Lv.${game.shadows[key]}]</h4><p>DPS: ${data.dps}</p></div><button class="buy-btn" ${game.gold < cost ? 'disabled' : ''} onclick="buyShadow('${key}')">${cost} G</button></div>`;
    }
    document.getElementById('shadows-list').innerHTML = shadowsHTML;

    let eqHTML = '';
    let nextWep = weaponData[game.equipment.weaponLevel];
    if (nextWep) {
        eqHTML = `<div class="shop-item"><div class="shop-item-info"><h4>${nextWep.name}</h4><p>Урон: x${nextWep.multiplier}</p></div><button class="buy-btn" ${game.gold < nextWep.cost ? 'disabled' : ''} onclick="buyWeapon()">${nextWep.cost} G</button></div>`;
    } else {
        eqHTML = `<p style="text-align:center; color: var(--accent-glow); margin-top:10px;">Всі предмети куплено!</p>`;
    }
    document.getElementById('equipment-list').innerHTML = eqHTML;
}

function updateUI() {
    // Оновлення рангу
    let rankInfo = getPlayerRankInfo(game.level);
    let rankEl = document.getElementById('player-rank');
    rankEl.innerText = rankInfo.name;
    rankEl.className = rankInfo.class;

    document.getElementById('level-display').innerText = game.level;
    document.getElementById('gold-display').innerText = Math.floor(game.gold);
    document.getElementById('click-dmg-display').innerText = getClickDamage();
    document.getElementById('dps-display').innerText = getShadowDPS();
    
    document.getElementById('stat-str').innerText = game.stats.str;
    document.getElementById('stat-agi').innerText = game.stats.agi;
    document.getElementById('stat-int').innerText = game.stats.int;
    document.getElementById('stat-points').innerText = game.statPoints;
    
    let maxExp = Math.floor(100 * Math.pow(1.3, game.level - 1));
    let expPercent = (game.exp / maxExp) * 100;
    document.getElementById('exp-bar').style.width = `${expPercent}%`;
    document.getElementById('exp-text').innerText = `${Math.floor(game.exp)} / ${maxExp} XP`;

    document.querySelectorAll('.upgrade-btn').forEach(btn => {
        btn.style.display = game.statPoints > 0 ? 'inline-block' : 'none';
    });
    
    updateMonsterHPUI();
    renderShop();
}

function resetGame() {
    if(confirm('Видалити збереження назавжди?')) {
        localStorage.removeItem('soloSave');
        try { if (tg && tg.CloudStorage) tg.CloudStorage.removeItem('soloSave'); } catch(e) {}
        location.reload();
    }
}

initGame();
